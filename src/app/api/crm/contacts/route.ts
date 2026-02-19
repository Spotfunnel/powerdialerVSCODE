import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma, withPrismaRetry } from "@/lib/prisma";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50"), 100);
        const search = searchParams.get("q") || "";
        const status = searchParams.get("status") || "READY";

        const sortBy = searchParams.get("sortBy") || "createdAt";
        const sortOrder = searchParams.get("sortOrder") as 'asc' | 'desc' || "desc";

        const skip = (page - 1) * pageSize;

        const where: Prisma.LeadWhereInput = {};

        // Only apply status filter if NOT searching (or if explicitly asking for ALL)
        if (status !== 'ALL' && !search) {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { companyName: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { phoneNumber: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        console.log(`[CRM] Fetching leads page=${page} q="${search}" status=${status}`);

        const { leads, total } = await withPrismaRetry(async () => {
            const [leads, total] = await Promise.all([
                prisma.lead.findMany({
                    where,
                    skip,
                    take: pageSize,
                    orderBy: [{ [sortBy]: sortOrder }, { id: 'asc' }],
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        companyName: true,
                        phoneNumber: true,
                        email: true,
                        status: true,
                        attempts: true,
                        nextCallAt: true,
                        lastCalledAt: true,
                        priority: true,
                        createdAt: true,
                        assignedTo: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }),
                prisma.lead.count({ where })
            ]);
            return { leads, total };
        }, 3, 1000, true);

        return NextResponse.json({ leads, total, page, pageSize });
    } catch (error: any) {
        console.error("[CRM] Failed to fetch leads:", error);
        return NextResponse.json({ error: "Failed to fetch leads", details: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        // Normalize phone: if just digits and starts with 04, make +614...
        let { phoneNumber, email, companyName, firstName, lastName, suburb, state, industry } = body;

        if (!phoneNumber) {
            return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
        }

        if (phoneNumber && phoneNumber.startsWith('0')) {
            phoneNumber = '+61' + phoneNumber.substring(1);
        } else if (phoneNumber && !phoneNumber.startsWith('+')) {
            phoneNumber = '+61' + phoneNumber;
        }

        // Sanitize empty strings to undefined to avoid unique constraint violations
        const cleanData = {
            ...body,
            phoneNumber,
            email: email || undefined,
            companyName: companyName || undefined,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            suburb: suburb || undefined,
            state: state || undefined,
            industry: industry || undefined,
            status: 'READY',
            source: 'MANUAL',
        };

        const newLead = await prisma.lead.create({
            data: cleanData as any // Bypass strict type check
        });

        return NextResponse.json(newLead);
    } catch (error: any) {
        console.error("Failed to create lead:", error);

        if (error.code === 'P2002') {
            return NextResponse.json({ error: "A contact with this phone number already exists." }, { status: 409 });
        }

        return NextResponse.json({ error: error.message || "Failed to create lead" }, { status: 500 });
    }
}
