
const fs = require('fs');
try {
    const buf = fs.readFileSync('twilio_secrets.txt');
    console.log(buf.toString('hex'));
} catch (e) {
    console.error(e);
}
