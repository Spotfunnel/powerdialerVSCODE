require('dotenv').config({ path: '.env.production' });

if (process.env.DATABASE_URL) {
    process.env.POSTGRES_PRISMA_URL = process.env.DATABASE_URL;
    process.env.POSTGRES_URL_NON_POOLING = process.env.DATABASE_URL;
}

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const filePath = 'solar_installers_ab_crm_FINAL_LOCATION_WEBSITE_DEDUPED.csv';
    if (!fs.existsSync(filePath)) {
        console.error('CSV file not found: ' + filePath);
        process.exit(1);
    }

    console.log('--- FINAL CRM POPULATION INITIATED ---');

    try {
        await prisma.$connect();
        console.log('Connected to database.');
    } catch (e) {
        console.error('Connection failed:', e.message);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    console.log(`Parsing ${lines.length - 1} leads...`);

    function parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            let char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
    }

    const seenPhones = new Set();
    const leadsToImport = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const values = parseCsvLine(line);
        if (values.length < 3) continue;

        let rawPhone = values[2] || '';
        let cleanPhone = rawPhone.replace(/\s+/g, '');

        if (!cleanPhone || seenPhones.has(cleanPhone)) continue;
        seenPhones.add(cleanPhone);

        // Map according to: company_name,website,phone_primary,email_primary,address,suburb,employees,cold_call_priority,state,postcode
        leadsToImport.push({
            companyName: values[0] || 'Unknown Business',
            website: values[1] || '',
            phoneNumber: cleanPhone,
            email: values[3] || '',
            address: values[4] || '',
            suburb: values[5] || '',
            employees: parseFloat(values[6]) || 0,
            priority: values[7] || 'B',
            state: values[8] || '',
            postcode: values[9] ? values[9].replace('\.0', '') : '',
            status: 'READY'
        });
    }

    console.log(`Importing ${leadsToImport.length} unique leads in batches of 200...`);

    const chunkSize = 200;
    for (let i = 0; i < leadsToImport.length; i += chunkSize) {
        const chunk = leadsToImport.slice(i, i + chunkSize);

        try {
            await prisma.lead.createMany({
                data: chunk,
                skipDuplicates: true
            });
            console.log(`Batch complete: Leads up to ${Math.min(i + chunkSize, leadsToImport.length)}`);
            await sleep(1000); // 1s safety gap
        } catch (err) {
            console.error(`Batch at index ${i} failed. Error:`, err.message);
            await sleep(5000); // Wait longer if DB is struggling
        }
    }

    const count = await prisma.lead.count();
    console.log(`--- IMPORT SUCCESSFUL: ${count} leads in database ---`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
