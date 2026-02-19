require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require("crypto");
const twilio = require("twilio");

const prisma = new PrismaClient();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
function getEncryptionKey() { return crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest(); }
function decrypt(encryptedData) {
    try {
        const buffer = Buffer.from(encryptedData, "base64");
        const hex = buffer.toString("hex");
        const iv = Buffer.from(hex.slice(0, IV_LENGTH * 2), "hex");
        const tag = Buffer.from(hex.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2), "hex");
        const encrypted = hex.slice((IV_LENGTH + TAG_LENGTH) * 2);
        const key = getEncryptionKey();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch (e) { return null; }
}

async function getCredentials() {
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    if (!settings?.twilioAccountSid || !settings?.twilioAuthToken) {
        throw new Error("Twilio credentials not configured");
    }

    return {
        sid: settings.twilioAccountSid,
        token: decrypt(settings.twilioAuthToken),
        from: settings.twilioFromNumbers?.split(',')[0].trim(),
        appSid: settings.twilioAppSid
    };
}

// THE REPLICATED logic
async function sendSMS({ to, body, leadId, userId }) {
    console.log(`[Debug] Starting sendSMS... To: ${to}, Lead: ${leadId}, User: ${userId}`);

    const { sid, token, from: defaultFrom } = await getCredentials();
    const client = twilio(sid, token);

    let fromNumber = defaultFrom;
    let twilioNumberId = null;

    console.log(`[Debug] Default From: ${fromNumber}`);

    const lead = leadId ? await prisma.lead.findUnique({ where: { id: leadId }, include: { assignedTo: { include: { phones: true } } } }) : null;
    const cleanTo = to.replace(/[\s\-\(\)]/g, "");

    // Check for existing conversation
    const existingConv = await prisma.conversation.findFirst({
        where: { contactPhone: cleanTo },
        orderBy: { updatedAt: 'desc' },
        include: { twilioNumber: true }
    });

    if (existingConv && existingConv.twilioNumber) {
        console.log(`[Debug] Found sticky conversation number: ${existingConv.twilioNumber.phoneNumber}`);
        fromNumber = existingConv.twilioNumber.phoneNumber;
        twilioNumberId = existingConv.twilioNumber.id;
    } else {
        // No conversation sticky number, prioritize the active SENDER's number
        if (userId) {
            const sender = await prisma.user.findUnique({
                where: { id: userId },
                include: { phones: { where: { isActive: true } } }
            });
            if (sender?.phones && sender.phones.length > 0) {
                console.log(`[Debug] Found Sender's number: ${sender.phones[0].phoneNumber}`);
                fromNumber = sender.phones[0].phoneNumber;
                twilioNumberId = sender.phones[0].id;
            }
        }

        // Fallback to Lead's assigned user if sender has no phone
        if (!twilioNumberId && lead?.assignedTo?.phones && lead.assignedTo.phones.length > 0) {
            const activePhone = lead.assignedTo.phones.find(p => p.isActive);
            if (activePhone) {
                console.log(`[Debug] Found Assigned Rep's number: ${activePhone.phoneNumber}`);
                fromNumber = activePhone.phoneNumber;
                twilioNumberId = activePhone.id;
            }
        }

        // If still no specific number, try to match defaultFrom to an ID
        if (!twilioNumberId && fromNumber) {
            const poolNum = await prisma.numberPool.findUnique({ where: { phoneNumber: fromNumber } });
            if (poolNum) {
                console.log(`[Debug] Matched default number to pool ID: ${poolNum.id}`);
                twilioNumberId = poolNum.id;
            } else {
                console.log(`[Debug] Default number NOT found in pool!`);
            }
        }
    }

    if (!fromNumber) throw new Error("No From number available for SMS");

    console.log(`[SMS] Sending to ${cleanTo} from ${fromNumber}`);

    // Dry Run - don't actually send to avoid spam, just confirm logic works
    return { success: true, fromBeforeSend: fromNumber };
}

async function main() {
    try {
        // Simulate what the API sends
        // 1. Get a random lead to use
        const lead = await prisma.lead.findFirst();
        // 2. Get a random user
        const user = await prisma.user.findFirst();

        if (!lead || !user) {
            console.error("Missing lead or user for test");
            return;
        }

        console.log(`Testing with Lead: ${lead.id} (${lead.phoneNumber}) and User: ${user.id}`);

        await sendSMS({
            to: lead.phoneNumber,
            body: "Test Body",
            leadId: lead.id,
            userId: user.id
        });

        console.log("SUCCESS: Logic trace completed without error.");

    } catch (e) {
        console.error("FATAL ERROR in Logic:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
