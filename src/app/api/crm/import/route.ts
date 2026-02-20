import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@/lib/types";

export async function POST(req: Request) {
    try {
        let rows: string[] = [];

        const contentType = req.headers.get("content-type") || "";

        let campaignId: string | null = null;

        if (contentType.includes("application/json")) {
            const body = await req.json();
            rows = body.rows || [];
            campaignId = body.campaignId || null;
        } else {
            const formData = await req.formData();
            const file = formData.get("file") as File;
            campaignId = (formData.get("campaignId") as string) || null;

            if (!file) {
                return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
            }
            const text = await file.text();
            rows = text.split("\n").filter(row => row.trim() !== "");
        }

        if (rows.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: "Empty batch or file" });
        }

        const headers = rows[0].split(",");
        const colMap = {
            company: headers.findIndex(h => h.toLowerCase().includes("company")),
            phone: headers.findIndex(h => h.toLowerCase().includes("phone")),
            first: headers.findIndex(h => h.toLowerCase().includes("first")),
            last: headers.findIndex(h => h.toLowerCase().includes("last")),
            employees: headers.findIndex(h => h.toLowerCase().includes("employee")),
            priority: headers.findIndex(h => h.toLowerCase().includes("priority")),
            email: headers.findIndex(h => h.toLowerCase().includes("email")),
            location: headers.findIndex(h => h.toLowerCase().includes("location")), // Add basic location support
            suburb: headers.findIndex(h => h.toLowerCase().includes("suburb")),
            state: headers.findIndex(h => h.toLowerCase().includes("state")),
        };

        if (colMap.phone === -1) {
            return NextResponse.json({ error: "CSV must have a 'Phone' column" }, { status: 400 });
        }

        // 1. Prepare Data in Memory
        const processedRows = [];
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(",").map(c => c.trim().replace(/^"|"$/g, ''));
            const rawPhone = cols[colMap.phone];
            if (!rawPhone) continue;

            const phone = rawPhone.replace(/\D/g, '').replace(/^0/, '+61'); // Assume AU
            if (phone.length < 8) continue; // Skip invalid phones

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
            } catch (err) {
                console.warn(`Batch update failed at index ${i}`, err);
            }
            updateCount += batch.length;
        }

        return NextResponse.json({
            success: true,
            count: uniqueRows.length,
            created: toCreate.length,
            updated: toUpdate.length
        });

    } catch (error: any) {
        console.error("Import Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
