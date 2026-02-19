import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function testAuthFlow() {
    const email = 'leo@getspotfunnel.com';
    const password = 'Walkergewert0!';

    console.log('🧪 Testing Authentication Flow');
    console.log('Email:', email);
    console.log('');

    try {
        // Step 1: Find user
        console.log('📡 Step 1: Finding user in database...');
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            console.log('❌ User not found!');
            return;
        }

        console.log('✅ User found:', user.email);
        console.log('   Name:', user.name);
        console.log('   Role:', user.role);
        console.log('');

        // Step 2: Verify password
        console.log('🔐 Step 2: Verifying password...');
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatch) {
            console.log('❌ Password does NOT match!');
            return;
        }

        console.log('✅ Password matches!');
        console.log('');

        // Step 3: Check what would be returned
        console.log('📦 Step 3: User object that would be returned:');
        const authUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            repPhoneNumber: user.repPhoneNumber,
        };
        console.log(JSON.stringify(authUser, null, 2));
        console.log('');

        console.log('✅ Authentication flow is working correctly!');
        console.log('');
        console.log('🔍 Next: Check NextAuth configuration and redirect logic');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testAuthFlow();
