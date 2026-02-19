
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Debugging Google Calendar Sync (Standalone) ---");

    // 1. Check for recent Google Sync Errors in LeadActivity
    console.log("\n1. Recent 'Google Calendar Sync Failed' Logs:");
    const errors = await prisma.leadActivity.findMany({
        where: {
            content: { contains: "Google Calendar Sync Failed" }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { lead: { select: { firstName: true, lastName: true, companyName: true } } }
    });

    if (errors.length === 0) {
        console.log("No explicit sync failure logs found in LeadActivity.");
    } else {
        errors.forEach(e => {
            console.log(`[${e.createdAt.toISOString()}] Lead: ${e.lead.companyName} | Error: ${e.content}`);
        });
    }

    // 2. Check Calendar Connections
    console.log("\n2. Checking Calendar Connections:");
    const connections = await prisma.calendarConnection.findMany({
        include: { user: { select: { email: true, name: true } } }
    });

    if (connections.length === 0) {
        console.log("CRITICAL: No CalendarConnection records found. Users are not authenticated with Google.");
    } else {
        for (const conn of connections) {
            const isExpired = conn.expiry ? new Date(conn.expiry) < new Date() : "Unknown";
            console.log(`User: ${conn.user.email} | Provider: ${conn.provider} | ID: ${conn.id}`);
            console.log(`   Access Token Present: ${!!conn.accessToken}`);
            console.log(`   Refresh Token Present: ${!!conn.refreshToken}`);
            console.log(`   Expired: ${isExpired} (Expiry: ${conn.expiry})`);
        }
    }

    // 3. Check Recent Meetings
    console.log("\n3. Recent Meetings (DB):");
    const meetings = await prisma.meeting.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { lead: true }
    });

    meetings.forEach(m => {
        console.log(`[${m.createdAt.toISOString()}] Lead: ${m.lead.companyName} | External ID: ${m.externalEventId} | URL: ${m.meetingUrl}`);
    });
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
