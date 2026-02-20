import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const pageSize = 50;
        const page = parseInt(searchParams.get("page") || "1");
        const skip = (page - 1) * pageSize;

        const logs = await prisma.call.findMany({
            take: pageSize,
            skip: skip,
            orderBy: { createdAt: "desc" },
            include: {
                lead: {
                    select: {
                        firstName: true,
                        lastName: true,
                        companyName: true,
                        phoneNumber: true
                    }
                },
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        const total = await prisma.call.count();

        // Rewrite Twilio recording URLs to proxy endpoint (auth required)
        const proxiedLogs = logs.map(log => ({
            ...log,
            recordingUrl: log.recordingUrl ? `/api/recordings/${log.id}` : null
        }));

        return NextResponse.json({
            logs: proxiedLogs,
            total,
            totalPages: Math.ceil(total / pageSize),
            currentPage: page
        });

    } catch (error) {
        console.error("Failed to fetch call history", error);
        return NextResponse.json({ error: "Failed to fetch call history" }, { status: 500 });
    }
}
