const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const csv = require('csv-parser');

const prisma = new PrismaClient();
const CSV_FILE = "solar_installers_ab_crm_SORTED_BY_LOCATION.csv";

async function run() {
    console.log(`Starting lead import from ${CSV_FILE}...`);

    let count = 0;
    const leads = [];

    // First read all to memory for batch processing or just processing
    await new Promise((resolve, reject) => {
        fs.createReadStream(CSV_FILE)
            .pipe(csv())
            .on('data', (row) => {
                leads.push(row);
            })
            .on('end', resolve)
            .on('error', reject);
    });

    console.log(`Read ${leads.length} leads from CSV.`);

    for (const row of leads) {
        try {
            // Clean phone number: remove non-digits, but keep + if present at start
            let phone = row.phone_primary || "";
            phone = phone.startsWith('+') ? '+' + phone.replace(/\D/g, '') : phone.replace(/\D/g, '');

            if (!phone) {
                console.warn(`Skipping lead ${row.company_name} - No phone number.`);
                continue;
            }

            // Ensure it starts with + if missing but looks like AU number
            if (!phone.startsWith('+')) {
                if (phone.startsWith('0')) {
                    phone = '+61' + phone.substring(1);
                } else if (phone.startsWith('61')) {
                    phone = '+' + phone;
                }
            }

            const employees = parseInt(row.employees) || 0;
            const location = [row.address, row.state, row.postcode].filter(Boolean).join(", ");

            await prisma.lead.upsert({
                where: { phoneNumber: phone },
                update: {
                    companyName: row.company_name,
                    email: row.email_primary || null,
                    website: row.website || null,
                    employees: employees,
                    location: location,
                    priority: row.cold_call_priority || "B",
                    status: "READY"
                },
                create: {
                    companyName: row.company_name,
                    phoneNumber: phone,
                    email: row.email_primary || null,
                    website: row.website || null,
                    employees: employees,
                    location: location,
                    priority: row.cold_call_priority || "B",
                    source: "CSV_IMPORT",
                    status: "READY"
                }
            });

            count++;
            if (count % 100 === 0) {
                console.log(`Imported ${count} leads...`);
            }
        } catch (err) {
            console.error(`Error importing ${row.company_name}:`, err.message);
        }
    }

    console.log(`Import complete! Total leads processed: ${count}`);
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
