import { NextRequest, NextResponse } from 'next/server';
import { prismaDirect } from "@/lib/prisma";

import { findLeadByPhone } from "@/lib/leads";

export async function GET(req: NextRequest) {
    try {
        const testPhone = "+61405175314";
        const matched = await findLeadByPhone(testPhone);

        const tables: any = await prismaDirect.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;

        const count = await (prismaDirect as any).leadActivity.count();

        const latest = await (prismaDirect as any).leadActivity.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { lead: true }
        });

        const samples = await prismaDirect.lead.findMany({
            select: { id: true, firstName: true, phoneNumber: true }
        });

        return NextResponse.json({
            success: true,
            tables,
            matchTest: {
                search: testPhone,
                found: matched?.id || 'NOT_FOUND',
                name: matched?.firstName || 'NONE'
            },
            count,
            latestSample: latest,
            leads: samples
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const lead = await prismaDirect.lead.upsert({
            where: { phoneNumber: "+61405175314" },
            create: {
                firstName: "StressTestLeo",
                phoneNumber: "+61405175314",
                status: "NEW",
                companyName: "StressTestCorp"
            },
            update: {
                firstName: "StressTestLeo"
            }
        });
        return NextResponse.json({ success: true, lead });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
