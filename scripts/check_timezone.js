
console.log("Node Version:", process.version);
try {
    const date = new Date("2026-02-13T08:00:00.000Z");
    const options = { timeZone: 'Australia/Sydney', timeStyle: 'short', dateStyle: 'full' };
    const formatted = new Intl.DateTimeFormat('en-US', options).format(date);
    console.log("Formatted:", formatted);
} catch (e) {
    console.error("Error formatting:", e.message);
}
