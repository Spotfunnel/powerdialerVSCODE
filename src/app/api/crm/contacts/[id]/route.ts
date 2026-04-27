import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { normalizeToE164 } from "@/lib/phone-utils";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const lead = await prisma.lead.findUnique({
            where: { id: params.id }
        });

        if (!lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        return NextResponse.json(lead);
    } catch (error: any) {
        console.error("Failed to fetch lead", error);
        return NextResponse.json({ error: error.message || "Failed to fetch lead" }, { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        // Normalize phone: if just digits and starts with 04, make +614...
        let { companyName, firstName, lastName, email, phoneNumber, suburb, state, industry, status, website, notes } = body;

        if (phoneNumber) {
            // Use shared normalizer (handles AU/US, strips double prefixes and spaces)
            phoneNumber = normalizeToE164(phoneNumber);
            if (!phoneNumber) {
                return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
            }
        }

        // Sanitize empty strings to undefined (but allow explicit null for clearing fields)
        const cleanData: Record<string, any> = {};
        if (companyName !== undefined) cleanData.companyName = companyName || undefined;
        if (firstName !== undefined) cleanData.firstName = firstName || undefined;
        if (lastName !== undefined) cleanData.lastName = lastName || undefined;
        if (email !== undefined) cleanData.email = email || undefined;
        if (phoneNumber !== undefined) cleanData.phoneNumber = phoneNumber || undefined;
        if (suburb !== undefined) cleanData.suburb = suburb || undefined;
        if (state !== undefined) cleanData.state = state || undefined;
        if (industry !== undefined) cleanData.industry = industry || undefined;
        if (status !== undefined) cleanData.status = status;
        if (website !== undefined) cleanData.website = website || undefined;
        if (notes !== undefined) cleanData.notes = notes || undefined;

        const updatedLead = await prisma.lead.update({
            where: { id: params.id },
            data: cleanData as any
        });

        return NextResponse.json(updatedLead);
    } catch (error: any) {
        console.error("Failed to update lead", error);

        if (error.code === 'P2002') {
            return NextResponse.json({ error: "A contact with this phone number already exists." }, { status: 409 });
        }

        return NextResponse.json({ error: error.message || "Failed to update lead" }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Find lead first
        const lead = await prisma.lead.findUnique({
            where: { id: params.id }
        });

        if (!lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        // Delete associated calls first if not on cascade
        await prisma.call.deleteMany({
            where: { leadId: params.id }
        });

        await prisma.lead.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Failed to delete lead", error);
        return NextResponse.json({ error: error.message || "Failed to delete lead" }, { status: 500 });
    }
}
