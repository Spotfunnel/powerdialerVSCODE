import { prismaDirect } from "./prisma";
import { normalizeToE164 } from "./phone-utils";

/**
 * Returns all plausible stored representations for a phone number so that
 * historical records (stored in varied formats) can still be matched.
 * Works for both AU and US numbers.
 */
export function normalizePhone(phone: string): string[] {
    if (!phone) return [];
    const digits = phone.replace(/\D/g, "");
    const e164 = normalizeToE164(phone);
    const variants = new Set<string>();

    if (phone) variants.add(phone);
    if (digits) variants.add(digits);
    if (e164) variants.add(e164);

    // AU: +614xxxxxxxx <-> 04xxxxxxxx <-> 614xxxxxxxx
    if (e164.startsWith("+614") && e164.length === 12) {
        const local = "0" + e164.substring(3);
        variants.add(local);
        variants.add(e164.substring(1)); // 614...
    }
    if (digits.startsWith("04") && digits.length === 10) {
        variants.add("+61" + digits.substring(1));
        variants.add("61" + digits.substring(1));
    }

    // US: +1XXXXXXXXXX <-> 1XXXXXXXXXX <-> XXXXXXXXXX
    if (e164.startsWith("+1") && e164.length === 12) {
        variants.add(e164.substring(1)); // 1XXXXXXXXXX
        variants.add(e164.substring(2)); // XXXXXXXXXX
    }

    return Array.from(variants).filter(Boolean);
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
