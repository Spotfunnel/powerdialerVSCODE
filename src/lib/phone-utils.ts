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
