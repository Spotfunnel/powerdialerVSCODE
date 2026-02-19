
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearPipeline() {
    console.log('🧹 Cleaning up pipeline...');

    try {
        // Delete leads that appear to be mock data
        // This targets leads with specific names often used in seeds or empty phone numbers created in bulk
        const deleted = await prisma.lead.deleteMany({
            where: {
                OR: [
                    { companyName: { contains: 'Mock', mode: 'insensitive' } },
                    { companyName: { contains: 'Test', mode: 'insensitive' } },
                    { firstName: { in: ['John', 'Jane', 'Alice', 'Bob'] } },
                    { source: 'MOCK_DATA' }
                ]
            }
        });

        console.log(`✅ Deleted ${deleted.count} mock leads.`);

    } catch (error) {
        console.error('❌ Failed to clear pipeline:', error);
    } finally {
        await prisma.$disconnect();
    }
}

clearPipeline();
