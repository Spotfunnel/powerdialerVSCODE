import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function resetPassword() {
    try {
        const email = 'leo@getspotfunnel.com';
        const newPassword = 'Walkergewert0!';

        console.log('🔐 Resetting password for:', email);

        // Hash the new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update the user
        const user = await prisma.user.update({
            where: { email },
            data: { passwordHash }
        });

        console.log('✅ Password reset successfully!');
        console.log('User:', user.email);
        console.log('Name:', user.name);
        console.log('New password:', newPassword);
        console.log('\nYou can now login with:');
        console.log('Email:', email);
        console.log('Password:', newPassword);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetPassword();
