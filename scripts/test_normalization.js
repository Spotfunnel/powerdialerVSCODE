// Isolation test for normalization logic
function normalizeToE164(phone) {
    let clean = phone.replace(/[\s\-\(\)\+]/g, "");
    // Handle AU Mobile (04...)
    if (clean.startsWith('04') && clean.length === 10) {
        return `+61${clean.substring(1)}`;
    }
    // If it starts with 4... (missing leading 0)
    if (clean.startsWith('4') && clean.length === 9) {
        return `+61${clean}`;
    }
    // If already has 61 but no +
    if (clean.startsWith('61') && clean.length === 11) {
        return `+${clean}`;
    }
    // Default: Add + if missing
    return `+${clean}`;
}

function normalizePhone(phone) {
    const digits = phone.replace(/\D/g, "");

    // If it's AU mobile
    if (digits.startsWith("614") && digits.length === 11) {
        const local = "0" + digits.substring(2);
        const e164 = "+" + digits;
        return [e164, local, digits];
    }

    if (digits.startsWith("04") && digits.length === 10) {
        const e164 = "+61" + digits.substring(1);
        const raw = "61" + digits.substring(1);
        return [digits, e164, raw];
    }

    const variations = [digits];
    if (phone.startsWith("+")) variations.push(phone);
    return variations;
}

console.log("Testing normalizeToE164...");
const testNumbers = [
    { input: "0418770000", expected: "+61418770000" },
    { input: "+61418770000", expected: "+61418770000" },
    { input: "418770000", expected: "+61418770000" },
    { input: "61418770000", expected: "+61418770000" },
    { input: "+1234567890", expected: "+1234567890" },
    { input: "1234567890", expected: "+1234567890" }
];

testNumbers.forEach(t => {
    const result = normalizeToE164(t.input);
    console.log(`Input: ${t.input.padEnd(15)} | Expected: ${t.expected.padEnd(15)} | Result: ${result.padEnd(15)} | ${result === t.expected ? "PASS" : "FAIL"}`);
});

console.log("\nTesting normalizePhone (Lead Lookup Variations)...");
const lookupTests = [
    { input: "+61418770000", contains: ["+61418770000", "0418770000", "61418770000"] },
    { input: "0418770000", contains: ["0418770000", "+61418770000", "61418770000"] }
];

lookupTests.forEach(t => {
    const results = normalizePhone(t.input);
    const pass = t.contains.every(c => results.includes(c));
    console.log(`Input: ${t.input.padEnd(15)} | Should contain: ${JSON.stringify(t.contains)} | Results: ${JSON.stringify(results)} | ${pass ? "PASS" : "FAIL"}`);
});
