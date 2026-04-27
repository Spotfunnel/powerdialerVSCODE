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
    _autoDisconnect = false // DEPRECATED: was killing the connection pool after every query, adding 100-300ms latency
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const isConnectionError =
                error?.message?.includes("Can't reach database") ||
                error?.message?.includes("timed out") ||
                error?.message?.includes("max clients reached") ||
                error?.message?.includes("MaxClientsInSessionMode") ||
                error?.code === "P1001" ||
                error?.code === "P1017";

            if (isConnectionError && i < maxRetries - 1) {
                console.warn(`[Prisma] Connection error, retrying in ${delay * (i + 1)}ms... (${i + 1}/${maxRetries})`);
                await prisma.$disconnect();
                await new Promise(res => setTimeout(res, delay * (i + 1)));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}
