const FROM = "+61405175314";
const TO = "+61480073731"; // Use one from pool
const COUNT = 100;

async function stress() {
    console.log(`Starting stress test: ${COUNT} concurrent SMS requests...`);
    const start = Date.now();
    const promises = [];

    for (let i = 0; i < COUNT; i++) {
        const formData = new URLSearchParams();
        formData.append('From', FROM);
        formData.append('To', TO);
        formData.append('Body', `Race condition test ${i}`);
        formData.append('MessageSid', `SMstress_${Date.now()}_${i}`);

        promises.push(
            fetch('http://localhost:3000/api/twilio/sms/inbound', {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
                .then(async r => {
                    if (r.status !== 200) {
                        const text = await r.text();
                        console.error(`Error ${r.status}: ${text.substring(0, 50)}`);
                    }
                    return r.status;
                })
                .catch(err => {
                    console.error("Fetch Error:", err.message);
                    return 500;
                })
        );
    }

    const results = await Promise.all(promises);
    const duration = (Date.now() - start) / 1000;
    const success = results.filter(s => s === 200).length;

    console.log(`--- Stress Test Finished ---`);
    console.log(`Duration: ${duration}s`);
    console.log(`Success: ${success}/${results.length}`);
    console.log(`Throughput: ${(success / duration).toFixed(2)} req/s`);

    if (success === COUNT) {
        console.log("PASS: All requests processed successfully (Indicates robust upsert/catch logic).");
    } else {
        console.log("FAIL: Some requests failed. Check logs for race condition errors.");
    }
}

stress();
