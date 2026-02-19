const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeToE164(phone) {
    if (!phone) return "";
    let clean = phone.replace(/[^\d\+]/g, "");
    if (clean.startsWith('+61') && (clean.length === 12 || clean.length === 13)) return clean;
    let digits = clean.startsWith('+') ? clean.substring(1) : clean;
    if (digits.startsWith('04') && digits.length === 10) return `+61${digits.substring(1)}`;
    if (digits.startsWith('4') && digits.length === 9) return `+61${digits}`;
    if (digits.startsWith('61') && (digits.length === 11 || digits.length === 12)) return `+${digits}`;
    if (digits.length === 10 && digits.startsWith('0')) return `+61${digits.substring(1)}`;
    let final = clean.startsWith('+') ? clean : `+${clean}`;
    return final.replace(/\++/g, "+");
}

async function migrate() {
    try {
        console.log("Starting Chunked Migration...");

        // 1. Process Leads in Chunks
        const allLeads = await prisma.lead.findMany({ select: { id: true, phoneNumber: true } });
        console.log(`Analyzing ${allLeads.length} leads...`);

        let leadUpdates = 0;
        let leadMerges = 0;
        let processed = 0;

        for (const l of allLeads) {
            processed++;
            if (processed % 100 === 0) console.log(`Processed ${processed}/${allLeads.length}...`);

            const normalized = normalizeToE164(l.phoneNumber);
            if (!normalized || normalized === l.phoneNumber) continue;

            // Check if another lead ALREADY has this normalized number
            const existing = await prisma.lead.findFirst({
                where: { phoneNumber: normalized, id: { not: l.id } }
            });

            if (existing) {
                // Merge
                await prisma.call.updateMany({ where: { leadId: l.id }, data: { leadId: existing.id } });
                await prisma.message.updateMany({ where: { leadId: l.id }, data: { leadId: existing.id } });
                await prisma.callback.updateMany({ where: { leadId: l.id }, data: { leadId: existing.id } });
                await prisma.meeting.updateMany({ where: { leadId: l.id }, data: { leadId: existing.id } });
                await prisma.lead.delete({ where: { id: l.id } });
                leadMerges++;
            } else {
                // Update
                try {
                    await prisma.lead.update({
                        where: { id: l.id },
                        data: { phoneNumber: normalized }
                    });
                    leadUpdates++;
                } catch (e) {
                    console.error(`Update failed for ${l.id}: ${e.message}`);
                }
            }
        }
        console.log(`Leads: ${leadUpdates} updated, ${leadMerges} merged.`);

        // 2. Convs
        const convs = await prisma.conversation.findMany();
        for (const c of convs) {
            const normalized = normalizeToE164(c.contactPhone);
            if (!normalized || normalized === c.contactPhone) continue;

            const existing = await prisma.conversation.findFirst({
                where: { contactPhone: normalized, twilioNumberId: c.twilioNumberId, id: { not: c.id } }
            });

            if (existing) {
                await prisma.message.updateMany({ where: { conversationId: c.id }, data: { conversationId: existing.id } });
                await prisma.conversation.delete({ where: { id: c.id } });
            } else {
                await prisma.conversation.update({ where: { id: c.id }, data: { contactPhone: normalized } });
            }
        }

        console.log("Migration Complete!");

    } catch (e) {
        console.error("CRITICAL ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}
migrate();
