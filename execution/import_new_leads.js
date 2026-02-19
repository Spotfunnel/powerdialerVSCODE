const fs = require('fs');
const csv = require('csv-parser');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CSV_FILE = 'solar_installers_ab_crm_SORTED_WITH_SUBURB.csv';

function normalizePhone(phone) {
    if (!phone) return null;
    let p = phone.replace(/[^0-9+]/g, '');
    if (p.startsWith('0')) {
        p = '+61' + p.substring(1);
    }
    // If no country code and length is reasonable for AU (9 digits usually excluding 0), append +61? 
    // But safely: if it doesn't start with +, add +61 if it looks like a local number.
    // The CSV has "04..." and "02...".
    // 0432 069 082 -> +61432069082
    return p;
}

async function main() {
    const results = [];
    console.log(`Reading ${CSV_FILE}...`);

    fs.createReadStream(CSV_FILE)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            console.log(`Parsed ${results.length} rows. Starting Upsert...`);

            let successes = 0;
            let errors = 0;

            for (const row of results) {
                // company_name,phone_primary,email_primary,address,suburb,employees,cold_call_priority,state,postcode
                const phone = normalizePhone(row.phone_primary);
                if (!phone) {
                    // console.log(`Skipping row without phone: ${row.company_name}`);
                    continue;
                }

                try {
                    await prisma.lead.upsert({
                        where: { phoneNumber: phone },
                        update: {
                            companyName: row.company_name,
                            email: row.email_primary || null,
                            location: row.address || null, // Keeping location as 'Address'
                            address: row.address || null,
                            suburb: row.suburb || null,
                            state: row.state || null,
                            postcode: row.postcode ? String(row.postcode) : null,
                            employees: row.employees ? parseInt(row.employees) : 0,
                            priority: row.cold_call_priority || 'B',
                            notes: `Imported from ${CSV_FILE}`
                        },
                        create: {
                            phoneNumber: phone,
                            companyName: row.company_name || 'Unknown',
                            email: row.email_primary || null,
                            location: row.address || null,
                            address: row.address || null,
                            suburb: row.suburb || null,
                            state: row.state || null,
                            postcode: row.postcode ? String(row.postcode) : null,
                            employees: row.employees ? parseInt(row.employees) : 0,
                            priority: row.cold_call_priority || 'B',
                            status: 'READY'
                        }
                    });
                    successes++;
                } catch (e) {
                    console.error(`Failed for ${phone}: ${e.message}`);
                    errors++;
                }

                if (successes % 100 === 0) process.stdout.write('.');
            }

            console.log(`\n\nDone! Success: ${successes}, Errors: ${errors}`);
            process.exit(0);
        });
}

main();
