import { PrismaClient } from "@prisma/client";

export enum LeadStatus {
    READY = "READY",
    LOCKED = "LOCKED",
    IN_CALL = "IN_CALL",
    DONE = "DONE",
    BAD_NUMBER = "BAD_NUMBER",
    PAUSED = "PAUSED",
}

const globalForPrisma = global as unknown as {
    prisma: PrismaClient;
    prismaDirect: PrismaClient;
};

const prismaClientSingleton = () => {
    const rawUrl = (process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || '').trim();
    const url = rawUrl;

    // Mask the URL for safe logging
    const maskedUrl = url.replace(/:([^@]+)@/, ':****@');
    console.log(`[Prisma] Initializing with: ${maskedUrl}`);

    // Safety check for common Supabase pooling issues
    const isPooler = url.includes('pooler') || url.includes('pgbouncer=true');

    return new PrismaClient({
        log: ["error"],
        datasources: {
            db: {
                url: url.includes('connection_limit')
                    ? url.replace(/connection_limit=\d+/, 'connection_limit=1')
                    : url + (url.includes('?') ? '&' : '?') + 'connection_limit=1' + (isPooler && !url.includes('statement_cache_size') ? '&statement_cache_size=0' : '')
            }
        },
        ...(isPooler ? {
            __internal: {
                engine: {
                    connection_limit: 1,
                }
            }
        } : {})
    } as any);
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

// Direct connection for migrations and transactions
export const prismaDirect =
    globalForPrisma.prismaDirect ||
    new PrismaClient({
        datasources: {
            db: {
                url: process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL
            }
        },
        log: ["error"],
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
    globalForPrisma.prismaDirect = prismaDirect;
} else {
    // In production, force singleton even in serverless if possible
    if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;
    if (!globalForPrisma.prismaDirect) globalForPrisma.prismaDirect = prismaDirect;
}

// Graceful shutdown to prevent connection leaks
if (typeof window === 'undefined') {
    process.on('beforeExit', async () => {
        await prisma.$disconnect();
        await prismaDirect.$disconnect();
    });
}

export async function withPrismaRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 1000,
    autoDisconnect = false
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await fn();
            if (autoDisconnect) {
                await prisma.$disconnect();
            }
            return result;
        } catch (error: any) {
            lastError = error;
            // Check for connection-related errors
            const isConnectionError =
                error?.message?.includes("Can't reach database") ||
                error?.message?.includes("timed out") ||
                error?.message?.includes("max clients reached") ||
                error?.message?.includes("MaxClientsInSessionMode") ||
                error?.code === "P1001" ||
                error?.code === "P1017";

            if (isConnectionError && i < maxRetries - 1) {
                console.warn(`[Prisma] Connection error, retrying in ${delay * (i + 1)}ms... (${i + 1}/${maxRetries})`);
                // Disconnect and reconnect to clear stale connections
                await prisma.$disconnect();
                await new Promise(res => setTimeout(res, delay * (i + 1)));
                continue;
            }

            // Still disconnect on final error if requested
            if (autoDisconnect) {
                await prisma.$disconnect().catch(() => { });
            }
            throw error;
        }
    }
    throw lastError;
}
