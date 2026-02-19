import { NextResponse } from 'next/server';
import { prismaDirect, withPrismaRetry } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const messageSid = formData.get('MessageSid') as string;
        const messageStatus = formData.get('MessageStatus') as string; // queued, failed, sent, delivered, undelivered
        const errorCode = formData.get('ErrorCode') as string;
        const errorMessage = formData.get('ErrorMessage') as string;

        console.log(`[SMS Status] SID: ${messageSid}, Status: ${messageStatus}`);

        if (messageSid && messageStatus) {
            await withPrismaRetry(async () => {
                await prismaDirect.message.update({
                    where: { twilioMessageSid: messageSid },
                    data: {
                        status: messageStatus.toUpperCase(),
                        errorCode: errorCode || null,
                        errorMessage: errorMessage || null,
                        sentAt: ['SENT', 'DELIVERED'].includes(messageStatus.toUpperCase()) ? new Date() : undefined
                    }
                });
            });
        }

        return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
    } catch (error) {
        console.error("[SMS Status] Critical Failure - activating Edge Buffer:", error);

        try {
            const fs = require('fs');
            const path = require('path');
            const tmpDir = path.join(process.cwd(), '.tmp');

            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            const deadLetterPath = path.join(tmpDir, 'dead_letter_status.json');
            const payload = {
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : String(error),
                params: Object.fromEntries(await req.clone().formData())
            };

            fs.appendFileSync(deadLetterPath, JSON.stringify(payload) + "\n");
            console.log("[SMS Status] Update safely buffered to dead_letter_status.json");
        } catch (bufferErr) {
            console.error("[SMS Status] FAILED TO BUFFER STATUS:", bufferErr);
        }

        return new NextResponse("Service Unavailable", { status: 503 });
    }
}
