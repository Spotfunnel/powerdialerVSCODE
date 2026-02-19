import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// TEMPORARY ADMIN BYPASS - DELETE AFTER LOGIN IS FIXED
export async function POST(request: Request) {
    try {
        const { email, password, adminPassword } = await request.json();

        // Check admin password from env
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return NextResponse.json({ error: 'Invalid admin password' }, { status: 401 });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Test password
        const match = await bcrypt.compare(password, user.passwordHash);

        return NextResponse.json({
            email: user.email,
            passwordMatch: match,
            hasHash: !!user.passwordHash,
            hashLength: user.passwordHash?.length,
            userId: user.id,
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
