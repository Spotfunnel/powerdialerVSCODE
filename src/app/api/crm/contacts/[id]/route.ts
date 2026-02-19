import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

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
        let { companyName, firstName, lastName, email, phoneNumber, suburb, state, industry } = body;

        if (phoneNumber) {
            phoneNumber = phoneNumber.replace(/\s+/g, ''); // Remove spaces
            if (phoneNumber.startsWith('0')) {
                phoneNumber = '+61' + phoneNumber.substring(1);
            } else if (!phoneNumber.startsWith('+')) {
                phoneNumber = '+61' + phoneNumber;
            }
        }

        // Sanitize empty strings to undefined
        const cleanData = {
            companyName: companyName || undefined,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            email: email || undefined,
            phoneNumber: phoneNumber || undefined,
            suburb: suburb || undefined,
            state: state || undefined,
            industry: industry || undefined,
        };

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
