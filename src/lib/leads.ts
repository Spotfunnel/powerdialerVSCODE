import { prismaDirect } from "./prisma";

/**
 * Normalizes a phone number to standard formats for matching.
 * Handles +61, 04, and raw digits.
 */
export function normalizePhone(phone: string): string[] {
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

    // Default: just return the clean digits and the original if it had a +
    const variations = [digits];
    if (phone.startsWith("+")) variations.push(phone);
    return variations;
}

/**
 * Finds a lead by phone number using fuzzy matching for AU formats.
 */
export async function findLeadByPhone(phone: string) {
    if (!phone) return null;

    const variations = normalizePhone(phone);

    // Try findUnique first with the exact input
    let lead = await prismaDirect.lead.findUnique({
        where: { phoneNumber: phone }
    });

    if (lead) return lead;

    // Try variations
    lead = await prismaDirect.lead.findFirst({
        where: {
            phoneNumber: {
                in: variations
            }
        }
    });

    return lead;
}
