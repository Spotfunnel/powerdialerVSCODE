/**
 * Checks if an Australian E.164 number is a landline (cannot receive SMS).
 * AU landlines: +61 2/3/7/8 (area codes for NSW, VIC, QLD, SA/WA/NT/TAS)
 * AU mobiles: +61 4xx (always start with 4)
 */
export function isAustralianLandline(e164Number: string): boolean {
    if (!e164Number.startsWith('+61')) return false;
    const afterCountry = e164Number.substring(3);
    // AU mobiles start with 4, everything else (2,3,7,8) is landline
    return afterCountry.length >= 1 && /^[23789]/.test(afterCountry);
}

export function normalizeToE164(phoneNumber: string): string {
    if (!phoneNumber) return "";

    // Remove all non-digit characters except '+'
    const clean = phoneNumber.replace(/[^\d+]/g, "");
    let digits = clean.replace(/\D/g, "");

    // Strip duplicated AU country code (e.g. "+61+611800951077" -> "611800951077")
    if (digits.startsWith('6161')) {
        digits = digits.substring(2);
    }
    // Strip duplicated US country code (e.g. "+1+18504390035" -> "18504390035")
    if (digits.startsWith('11') && digits.length === 12) {
        digits = digits.substring(1);
    }

    // Already in E.164 with country code
    if (clean.startsWith('+') && digits.length >= 10) {
        return `+${digits}`;
    }

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

    // Handle US numbers: 10 digits starting with 2-9 (no leading 0 or 1)
    if (digits.length === 10 && /^[2-9]/.test(digits)) {
        return `+1${digits}`;
    }

    // Handle US numbers with country code: 1XXXXXXXXXX (11 digits starting with 1)
    if (digits.length === 11 && digits.startsWith('1') && /^1[2-9]/.test(digits)) {
        return `+${digits}`;
    }

    // If no digits found at all, return empty string (prevents returning just "+")
    if (!digits) return "";

    // Last resort: If no '+', assume + as required by Twilio
    let final = clean.startsWith('+') ? clean : `+${clean}`;

    // Final check: Remove any double ++ that might have been created
    return final.replace(/\++/g, "+");
}
