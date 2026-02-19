const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const deadLetterPath = path.join(process.cwd(), '.tmp', 'dead_letter_sms.json');

async function recover() {
    if (!fs.existsSync(deadLetterPath)) {
        console.log("No dead letter SMS found. Nothing to recover.");
        return;
    }

    console.log("Starting SMS recovery from dead_letter_sms.json...");
    const content = fs.readFileSync(deadLetterPath, 'utf8');
    const lines = content.trim().split('\n');
    let recoveredCount = 0;

    for (const line of lines) {
        if (!line) continue;
        try {
            const entry = JSON.parse(line);
            const { params } = entry;

            const fromNumber = params.From;
            const toNumber = params.To;
            const body = params.Body;
            const messageSid = params.MessageSid;

            console.log(`Processing recovery for: ${messageSid} (${fromNumber} -> ${toNumber})`);

            // Inbound logic mimicry (Simplified for recovery)
            const contact = await prisma.lead.findFirst({
                where: {
                    OR: [
                        { phoneNumber: fromNumber },
                        { phoneNumber: fromNumber.replace(/^\+61/, '0') },
                        { phoneNumber: fromNumber.replace(/^0/, '+61') }
                    ]
                }
            });

            const numberPool = await prisma.numberPool.findUnique({
                where: { phoneNumber: toNumber }
            });

            let assignedUserId = contact?.assignedToId || numberPool?.ownerUserId;
            if (!assignedUserId) {
                const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
                assignedUserId = admin?.id;
            }

            // Create/Update Conversation
            let conversation = await prisma.conversation.findFirst({
                where: {
                    contactPhone: fromNumber,
                    twilioNumberId: numberPool?.id || null
                }
            });

            if (conversation) {
                await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: {
                        lastMessageAt: new Date(entry.timestamp),
                        unreadCount: { increment: 1 },
                        status: "OPEN"
                    }
                });
            } else {
                conversation = await prisma.conversation.create({
                    data: {
                        contactPhone: fromNumber,
                        contactId: contact?.id,
                        assignedUserId: assignedUserId,
                        twilioNumberId: numberPool?.id || null,
                        lastMessageAt: new Date(entry.timestamp),
                        unreadCount: 1,
                        status: "OPEN"
                    }
                });
            }

            // Create Message
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    direction: "INBOUND",
                    fromNumber: fromNumber,
                    toNumber: toNumber,
                    body: body,
                    status: "RECEIVED",
                    twilioMessageSid: messageSid,
                    leadId: contact?.id,
                    userId: assignedUserId,
                    createdAt: new Date(entry.timestamp)
                }
            });

            if (contact?.id) {
                await prisma.leadActivity.create({
                    data: {
                        leadId: contact.id,
                        type: "SMS_INBOUND",
                        content: `[RECOVERED] ${body}`,
                        userId: assignedUserId,
                        createdAt: new Date(entry.timestamp)
                    }
                });
            }

            recoveredCount++;
        } catch (err) {
            console.error("Error processing recovery line:", err);
        }
    }

    console.log(`Recovery complete. ${recoveredCount} messages recovered.`);

    // Archive the processed file
    const archivePath = path.join(process.cwd(), '.tmp', `recovered_sms_${Date.now()}.json`);
    fs.renameSync(deadLetterPath, archivePath);
    console.log(`Buffered file archived to: ${archivePath}`);
}

recover()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
