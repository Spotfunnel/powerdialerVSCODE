
const fs = require('fs');

try {
    // PowerShell '>' creates UTF-16LE file
    const content = fs.readFileSync('verify_output_4.txt', 'utf16le');
    const lines = content.split('\n');
    lines.forEach(line => {
        if (line.includes('[PASS]') || line.includes('[FAIL]') || line.includes('Success') || line.includes('Failed')) {
            console.log(line.trim());
        }
    });
} catch (e) {
    console.error("Read Error:", e);
}
