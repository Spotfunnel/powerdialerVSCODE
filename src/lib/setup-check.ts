import { prisma } from "./prisma";

export async function isSetupComplete() {
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    return !!settings?.setupCompleted;
}

export async function markSetupComplete() {
    await prisma.settings.upsert({
        where: { id: "singleton" },
        update: { setupCompleted: true },
        create: { id: "singleton", setupCompleted: true },
    });
}
