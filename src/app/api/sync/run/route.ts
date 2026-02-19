import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
    const jobs = await prisma.syncJob.findMany({
        where: {
            status: "PENDING",
            nextRunAt: { lte: new Date() },
            attempts: { lt: 5 }
        },
        take: 10
    });

    const results = [];

    for (const job of jobs) {
        try {
            if (job.type === "NATIVE_SYNC") {
                // Future native sync logic here
            }

            await prisma.syncJob.update({
                where: { id: job.id },
                data: { status: "COMPLETED" }
            });
            results.push({ id: job.id, status: "SUCCESS" });
        } catch (error: any) {
            await prisma.syncJob.update({
                where: { id: job.id },
                data: {
                    attempts: { increment: 1 },
                    lastError: error.message,
                    nextRunAt: new Date(Date.now() + Math.pow(2, job.attempts + 1) * 60000)
                }
            });
            results.push({ id: job.id, status: "FAILED", error: error.message });
        }
    }

    return NextResponse.json({ processed: jobs.length, results });
}
