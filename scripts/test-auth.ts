import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function testAuth() {
    try {
        const email = 'leo@getspotfunnel.com';
        const password = 'Walkergewert0!';

        console.log('🔍 Testing authentication for:', email);
        console.log('Password to test:', password);
        console.log('');

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            console.log('❌ User not found!');
            return;
        }

        console.log('✅ User found in database');
        console.log('User ID:', user.id);
        console.log('Email:', user.email);
        console.log('Name:', user.name);
        console.log('Role:', user.role);
        console.log('Has password hash:', !!user.passwordHash);
        console.log('');

        // Test password comparison
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);

        console.log('🔐 Password verification:');
        console.log('Password matches:', passwordMatch ? '✅ YES' : '❌ NO');

        if (!passwordMatch) {
            console.log('');
            console.log('⚠️  Password does NOT match!');
            console.log('This means the hash in the database is incorrect.');
        } else {
            console.log('');
            console.log('✅ Password is correct!');
            console.log('The issue must be elsewhere (NextAuth config, session, etc.)');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testAuth();
