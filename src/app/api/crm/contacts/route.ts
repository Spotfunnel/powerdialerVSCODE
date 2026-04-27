import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { normalizeToE164 } from "@/lib/phone-utils";

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

        const campaignId = searchParams.get("campaignId") || "";
        const where: Prisma.LeadWhereInput = {};

        // Only apply status filter if NOT searching (or if explicitly asking for ALL)
        if (status !== 'ALL' && !search) {
            where.status = status;
        }

        if (campaignId) {
            where.campaignId = campaignId;
        }

        if (search) {
            // If search looks like a phone number (has digits), also try digit-only matching
            const searchDigits = search.replace(/\D/g, '');
            const isPhoneSearch = searchDigits.length >= 4;

            const conditions: Prisma.LeadWhereInput[] = [
                { companyName: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phoneNumber: { contains: search, mode: 'insensitive' } },
            ];

            // Fuzzy phone: strip formatting and match on digits only
            // e.g. "2 4853 9408" matches "+61248539408", "04 2222 3333" matches "+61422223333"
            if (isPhoneSearch) {
                conditions.push({ phoneNumber: { contains: searchDigits } });
                // Also try with +61 or +1 prefix stripped from search
                if (searchDigits.startsWith('61')) {
                    conditions.push({ phoneNumber: { contains: searchDigits.substring(2) } });
                }
                if (searchDigits.startsWith('0')) {
                    conditions.push({ phoneNumber: { contains: searchDigits.substring(1) } });
                }
            }

            where.OR = conditions;
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
                        campaignId: true,
                        suburb: true,
                        state: true,
                        industry: true,
                        website: true,
                        notes: true,
                        campaign: { select: { id: true, name: true } },
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

        // Use shared normalizer to handle AU/US formats and strip malformed input (double prefixes, spaces)
        phoneNumber = normalizeToE164(phoneNumber);
        if (!phoneNumber) {
            return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
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
