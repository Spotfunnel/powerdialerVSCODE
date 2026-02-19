import { prisma } from '../src/lib/prisma';

async function checkUser() {
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'leo@getspotfunnel.com' }
        });

        if (user) {
            console.log('✅ User found!');
            console.log('ID:', user.id);
            console.log('Email:', user.email);
            console.log('Name:', user.name);
            console.log('Role:', user.role);
            console.log('Has password hash:', !!user.passwordHash);
            console.log('Password hash length:', user.passwordHash?.length || 0);
        } else {
            console.log('❌ User NOT found in database');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
