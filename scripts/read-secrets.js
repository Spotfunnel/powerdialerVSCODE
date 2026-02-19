
const fs = require('fs');
const path = require('path');

try {
    const content = fs.readFileSync('twilio_secrets.txt', 'utf16le');
    console.log('--- SECRETS START ---');
    console.log(content);
    console.log('--- SECRETS END ---');
} catch (e) {
    console.error("Error reading secrets:", e.message);
}

try {
    const numbers = fs.readFileSync('twilio_numbers.txt', 'utf8');
    console.log('--- NUMBERS START ---');
    console.log(numbers);
    console.log('--- NUMBERS END ---');
} catch (e) {
    // Try utf16le for numbers just in case
    try {
        const numbers = fs.readFileSync('twilio_numbers.txt', 'utf16le');
        console.log('--- NUMBERS START (UTF16) ---');
        console.log(numbers);
        console.log('--- NUMBERS END ---');
    } catch (e2) {
        console.error("Error reading numbers:", e2.message);
    }
}
