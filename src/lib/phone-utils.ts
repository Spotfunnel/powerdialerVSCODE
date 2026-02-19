export function normalizeToE164(phoneNumber: string): string {
    if (!phoneNumber) return "";

    // Remove all non-digit characters except '+'
    const clean = phoneNumber.replace(/[^\d+]/g, "");
    const digits = clean.replace(/\D/g, "");

    // Handle Australian numbers without +61
    // Handle AU Mobile (04... -> +614...)
    if (digits.startsWith('04') && digits.length === 10) {
        return `+61${digits.substring(1)}`;
    }

    // Handle AU Mobile (4... -> +614...)
    if (digits.startsWith('4') && digits.length === 9) {
        return `+61${digits}`;
    }

    // Handle AU Landline or formatted (614... -> +614...)
    if (digits.startsWith('61') && (digits.length === 11 || digits.length === 12)) {
        return `+${digits}`;
    }

    // If it's already 10 digits and starts with 0 (maybe local AU landline?)
    if (digits.length === 10 && digits.startsWith('0')) {
        return `+61${digits.substring(1)}`;
    }

    // If no digits found at all, return empty string (prevents returning just "+")
    if (!digits) return "";

    // Last resort: If no '+', assume + as required by Twilio
    let final = clean.startsWith('+') ? clean : `+${clean}`;

    // Final check: Remove any double ++ that might have been created
    return final.replace(/\++/g, "+");
}
