import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
    try {
        const passwordHash = await bcrypt.hash('password123', 10);

        // Create Admin
        const user = await prisma.user.upsert({
            where: { email: 'admin@powerdialer.com' },
            update: {},
            create: {
                email: 'admin@powerdialer.com',
                name: 'Admin User',
                passwordHash,
                role: 'ADMIN',
                repPhoneNumber: '+15550199'
            },
        });

        // Add SpotFunnel User
        await prisma.user.upsert({
            where: { email: 'spotfunnel@outlook.com' },
            update: {},
            create: {
                email: 'spotfunnel@outlook.com',
                name: 'SpotFunnel Owner',
                passwordHash,
                role: 'ADMIN',
                repPhoneNumber: '+15550200'
            },
        });

        // Create Lead
        const lead = await prisma.lead.upsert({
            where: { phoneNumber: '+15550009999' },
            update: {},
            create: {
                firstName: 'Elon',
                lastName: 'Musk',
                companyName: 'Tesla Inc.',
                phoneNumber: '+15550009999',
                website: 'https://tesla.com',
                industry: 'Automotive',
                location: 'Austin, TX',
                status: 'READY'
            }
        });

        return NextResponse.json({ success: true, user, lead });
    } catch (error) {
        console.error("Setup failed:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
