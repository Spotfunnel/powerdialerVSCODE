import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@/lib/types";
import { normalizeToE164 } from "@/lib/phone-utils";
import { parseCSV, mapImportHeaders } from "@/lib/csv-parse";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        let parsedRows: string[][] = [];

        const contentType = req.headers.get("content-type") || "";

        let campaignId: string | null = null;

        if (contentType.includes("application/json")) {
            const body = await req.json();
            const rawRows: string[] = body.rows || [];
            campaignId = body.campaignId || null;
            // JSON rows come as pre-split strings — parse each to respect quoted fields
            parsedRows = parseCSV(rawRows.join("\n"));
        } else {
            const formData = await req.formData();
            const file = formData.get("file") as File;
            campaignId = (formData.get("campaignId") as string) || null;

            if (!file) {
                return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
            }
            const text = await file.text();
            parsedRows = parseCSV(text);
        }

        if (parsedRows.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: "Empty batch or file" });
        }

        const headers = parsedRows[0].map(h => h.trim());
        const colMap = mapImportHeaders(headers);

        if (colMap.phone === -1) {
            return NextResponse.json({ error: "CSV must have a 'Phone' column" }, { status: 400 });
        }

        // 1. Prepare Data in Memory
        const processedRows = [];
        for (let i = 1; i < parsedRows.length; i++) {
            const cols = parsedRows[i].map(c => c.trim());
            const rawPhone = cols[colMap.phone];
            if (!rawPhone) continue;

            // Shared normalizer: handles AU/US, strips double prefixes, spaces, etc.
            const phone = normalizeToE164(rawPhone);
            if (!phone || phone.length < 10) continue;

            processedRows.push({
                phoneNumber: phone,
                companyName: (colMap.company > -1 ? cols[colMap.company] : "Unknown Company") || "Unknown Company",
                firstName: colMap.first > -1 ? cols[colMap.first] : undefined,
                lastName: colMap.last > -1 ? cols[colMap.last] : "",
                employees: colMap.employees > -1 ? parseInt(cols[colMap.employees]) || 0 : 0,
                priority: colMap.priority > -1 ? (cols[colMap.priority].toUpperCase().includes("A") ? "A" : "B") : "B",
                email: colMap.email > -1 ? cols[colMap.email] : null,
                suburb: colMap.suburb > -1 ? cols[colMap.suburb] : (colMap.location > -1 ? cols[colMap.location] : undefined),
                state: colMap.state > -1 ? cols[colMap.state] : undefined,
                website: colMap.website > -1 ? cols[colMap.website] : undefined,
                status: LeadStatus.READY,
                source: "IMPORT",
                ...(campaignId ? { campaignId } : {}),
            });
        }

        // 2. Identify Existing Leads
        const allPhoneNumbers = processedRows.map(r => r.phoneNumber);
        const existingLeads = await prisma.lead.findMany({
            where: { phoneNumber: { in: allPhoneNumbers } },
            select: { phoneNumber: true }
        });
        const existingPhones = new Set(existingLeads.map(l => l.phoneNumber));

        // 3. Separate New vs Updates
        // Deduplicate input list by phone, taking the last occurrence
        const processedMap = new Map();
        processedRows.forEach(row => processedMap.set(row.phoneNumber, row));
        const uniqueRows = Array.from(processedMap.values());

        const toCreate: any[] = [];
        const toUpdate: any[] = [];

        for (const row of uniqueRows) {
            if (existingPhones.has(row.phoneNumber)) {
                toUpdate.push(row);
            } else {
                toCreate.push({ ...row, source: "IMPORT_NEW" });
            }
        }

        // 4. Batch Create (Fastest)
        if (toCreate.length > 0) {
            await prisma.lead.createMany({
                data: toCreate,
                skipDuplicates: true
            } as any);
        }

        // 5. Parallel Updates (Batched Transactions)
        // Use $transaction to use a SINGLE connection for the batch, avoiding "MaxClients" errors
        const BATCH_SIZE = 50;
        let updateCount = 0;
        const failedBatches: { startIndex: number; size: number; error: string }[] = [];

        for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
            const batch = toUpdate.slice(i, i + BATCH_SIZE);
            try {
                // Use explicit transaction to bundle updates into ONE DB call/connection
                await prisma.$transaction(
                    batch.map(row =>
                        prisma.lead.update({
                            where: { phoneNumber: row.phoneNumber },
                            data: {
                                companyName: row.companyName !== "Unknown Company" ? row.companyName : undefined,
                                firstName: row.firstName !== "Friend" ? row.firstName : undefined,
                                lastName: row.lastName || undefined,
                                // Only update if provided
                                email: row.email || undefined,
                                suburb: row.suburb || undefined,
                                state: row.state || undefined,
                                source: "IMPORT_MERGE",
                                ...(campaignId ? { campaignId } : {}),
                                updatedAt: new Date()
                            } as any
                        })
                    )
                );
                // Only count after the transaction commits.
                updateCount += batch.length;
            } catch (err) {
                console.warn(`Batch update failed at index ${i}`, err);
                failedBatches.push({
                    startIndex: i,
                    size: batch.length,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }

        return NextResponse.json({
            success: failedBatches.length === 0,
            count: uniqueRows.length,
            created: toCreate.length,
            updated: updateCount,
            queuedForUpdate: toUpdate.length,
            failedBatches,
        });

    } catch (error: any) {
        console.error("Import Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
