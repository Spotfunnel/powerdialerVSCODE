const fetch = require('node-fetch');

async function main() {
    const url = "https://www.getspotfunnel.com/api/twilio/inbound";
    const body = new URLSearchParams();
    body.append("From", "+15559998888"); // Unknown Number
    body.append("To", "+61489088403");
    body.append("CallSid", "SIMULATION_UNKNOWN_" + Date.now());

    console.log(`Hitting ${url}...`);
    try {
        const res = await fetch(url, {
            method: 'POST',
            body: body,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' } // Twilio standard
        });

        console.log(`Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log('Response:', text.slice(0, 500));
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}
main();
