/**
 * Characterization tests for US region support.
 *
 * Locks in observed behaviour for:
 *   - normalizeToE164() US-number edge cases (src/lib/phone-utils.ts)
 *   - Region resolution priority used by the twiml/bridge and
 *     voice/lookup-caller routes (src/app/api/twilio/twiml/bridge/route.ts,
 *     src/app/api/voice/lookup-caller/route.ts)
 *   - Region filter wiring on selectOutboundNumber options
 *     (src/lib/number-rotation.ts) — see TODO at the bottom for the parts that
 *     can't be exercised without a Prisma boundary mock.
 *
 * AU normalization is already covered by tests/phone-utils.test.ts; this file
 * only adds US-flavoured cases plus the new region-routing behaviour.
 */

import { describe, it, expect } from "vitest";
import { normalizeToE164 } from "@/lib/phone-utils";

// ---------------------------------------------------------------------------
// normalizeToE164 — US edge cases
// ---------------------------------------------------------------------------

describe("normalizeToE164 — US 10-digit (no country code)", () => {
    it("plain 10-digit area-code-2xx -> +1XXXXXXXXXX", () => {
        expect(normalizeToE164("2125551234")).toBe("+12125551234");
    });

    it("plain 10-digit area-code-9xx -> +1XXXXXXXXXX", () => {
        expect(normalizeToE164("9085551234")).toBe("+19085551234");
    });

    it("(XXX) XXX-XXXX punctuated form -> +1XXXXXXXXXX", () => {
        expect(normalizeToE164("(212) 555-1234")).toBe("+12125551234");
    });

    it("XXX.XXX.XXXX dotted form -> +1XXXXXXXXXX", () => {
        expect(normalizeToE164("212.555.1234")).toBe("+12125551234");
    });

    it("space-separated 'XXX XXX XXXX' -> +1XXXXXXXXXX", () => {
        expect(normalizeToE164("212 555 1234")).toBe("+12125551234");
    });

    it("dashed 'XXX-XXX-XXXX' -> +1XXXXXXXXXX", () => {
        expect(normalizeToE164("212-555-1234")).toBe("+12125551234");
    });
});

describe("normalizeToE164 — US 11-digit with leading 1", () => {
    it("11-digit 1XXXXXXXXXX -> +1XXXXXXXXXX", () => {
        expect(normalizeToE164("12125551234")).toBe("+12125551234");
    });

    it("'1 (212) 555-1234' formatted -> +12125551234", () => {
        expect(normalizeToE164("1 (212) 555-1234")).toBe("+12125551234");
    });

    it("'1-212-555-1234' dashed -> +12125551234", () => {
        expect(normalizeToE164("1-212-555-1234")).toBe("+12125551234");
    });
});

describe("normalizeToE164 — US already E.164 / country-coded", () => {
    it("'+12125551234' (already E.164) is preserved", () => {
        expect(normalizeToE164("+12125551234")).toBe("+12125551234");
    });

    it("'+1 (212) 555-1234' formatted E.164 -> +12125551234", () => {
        expect(normalizeToE164("+1 (212) 555-1234")).toBe("+12125551234");
    });

    it("doubled +1 country code is collapsed", () => {
        expect(normalizeToE164("+1+12125551234")).toBe("+12125551234");
    });
});

describe("normalizeToE164 — US area-code boundaries", () => {
    // US area codes never start with 0 or 1 (NANP rule). The implementation
    // explicitly requires /^[2-9]/ for the bare 10-digit branch, so these
    // characterization tests pin that behaviour.
    it("10-digit starting with 0 is NOT treated as US", () => {
        // 0212555... falls through US branch; current impl treats leading-0
        // 10-digit as AU landline (drops 0 and prepends +61).
        expect(normalizeToE164("0212555123")).toBe("+61212555123");
    });

    it("10-digit starting with 1 is NOT treated as US (no E.164 mapping for it)", () => {
        // 1212555... isn't a valid bare US number; impl leaves it raw with '+'.
        expect(normalizeToE164("1212555123")).toBe("+1212555123");
    });

    it("11-digit starting with '1' but second digit < 2 is NOT picked up by the 11-digit US branch", () => {
        // /^1[2-9]/ guard means 1-1XXXXXXXXX falls through. Verify the impl's
        // last-resort behaviour: returns the raw '+digits' string.
        expect(normalizeToE164("11055551234")).toBe("+11055551234");
    });
});

describe("normalizeToE164 — US mixed-format / noise inputs", () => {
    it("leading/trailing whitespace is ignored for 10-digit US", () => {
        expect(normalizeToE164("  2125551234  ")).toBe("+12125551234");
    });

    it("embedded letters between digits are stripped (10-digit US)", () => {
        // The implementation strips everything except [\d+], so letters
        // dropped from the middle leave a clean 10-digit US number.
        expect(normalizeToE164("212abc555def1234")).toBe("+12125551234");
    });

    it("'+1' followed by formatted 10-digit US -> +1XXXXXXXXXX", () => {
        expect(normalizeToE164("+1 212.555.1234")).toBe("+12125551234");
    });

    it("US tollfree 800 number normalizes to +1800XXXXXXX", () => {
        expect(normalizeToE164("8005551234")).toBe("+18005551234");
    });

    it("US tollfree 1-800 with leading 1 normalizes to +1800XXXXXXX", () => {
        expect(normalizeToE164("18005551234")).toBe("+18005551234");
    });

    it("9-digit US-looking number is NOT promoted to E.164 US", () => {
        // 9 digits starting with 2 doesn't satisfy the 10-digit US rule and
        // doesn't satisfy any AU rule either -> last-resort raw '+'.
        expect(normalizeToE164("212555123")).toBe("+212555123");
    });

    it("12-digit US-looking number is NOT promoted by either branch (>11 digits)", () => {
        // 12 digits starting with 1 falls outside both the 11-digit US guard
        // and the 11/12-digit AU guard (which requires '61' prefix).
        expect(normalizeToE164("121255512345")).toBe("+121255512345");
    });
});

// ---------------------------------------------------------------------------
// Region resolution priority
//
// Both /api/twilio/twiml/bridge and /api/voice/lookup-caller use the same
// rule when computing the region they pass to selectOutboundNumber:
//
//   1. campaign.region (if set)
//   2. phoneNumber.startsWith('+1')  -> 'US'
//   3. phoneNumber.startsWith('+61') -> 'AU'
//   4. otherwise undefined
//
// The route handlers themselves require a Next.js Request, Prisma, and a
// running DB — out of scope for unit tests. We re-implement the priority as
// a pure helper here so the contract is locked down. If either route ever
// drifts from this rule, this test will keep passing (that's a known gap —
// see the TODO at the bottom).
// ---------------------------------------------------------------------------

function resolveRegion(
    phoneNumber: string,
    campaignRegion?: string | null
): string | undefined {
    if (campaignRegion) return campaignRegion;
    if (phoneNumber.startsWith("+1")) return "US";
    if (phoneNumber.startsWith("+61")) return "AU";
    return undefined;
}

describe("region resolution — priority order (mirrors twiml/bridge & lookup-caller)", () => {
    it("campaign.region wins over US-shaped phone number", () => {
        expect(resolveRegion("+12125551234", "AU")).toBe("AU");
    });

    it("campaign.region wins over AU-shaped phone number", () => {
        expect(resolveRegion("+61412345678", "US")).toBe("US");
    });

    it("campaign.region wins even when phone is unclassifiable", () => {
        expect(resolveRegion("+447700900000", "US")).toBe("US");
    });

    it("falls back to +1 -> US when no campaign region", () => {
        expect(resolveRegion("+12125551234")).toBe("US");
        expect(resolveRegion("+12125551234", null)).toBe("US");
        expect(resolveRegion("+12125551234", undefined)).toBe("US");
    });

    it("falls back to +61 -> AU when no campaign region", () => {
        expect(resolveRegion("+61412345678")).toBe("AU");
    });

    it("returns undefined when neither campaign nor phone hint a region", () => {
        expect(resolveRegion("+447700900000")).toBeUndefined();
        expect(resolveRegion("")).toBeUndefined();
    });

    it("empty-string campaign region is treated as 'no region' and falls through", () => {
        // Both routes use a truthy check (`if (campaignRegion)`), so empty
        // string must not short-circuit.
        expect(resolveRegion("+12125551234", "")).toBe("US");
    });

    it("US tollfree (+1800...) resolves to US via country-code fallback", () => {
        expect(resolveRegion("+18005551234")).toBe("US");
    });
});

// ---------------------------------------------------------------------------
// number-rotation region filter — TODO (Prisma-bound, can't unit-test cleanly)
//
// selectOutboundNumber(opts) in src/lib/number-rotation.ts threads opts.region
// through to the Prisma where-clause as `regionTag: <region>` on every query
// (owner-match, area-code-match, round-robin) and short-circuits with `null`
// when region === 'US' and the pool is empty (US has no settings fallback,
// unlike AU).
//
// To exercise this without standing up Postgres + Prisma we'd need to mock
// the `@/lib/prisma` module via vi.mock — doable, but it leaks heavy boundary
// mocking into what is otherwise a pure-function test file. Sketch of what
// such a test would look like:
//
//   vi.mock("@/lib/prisma", () => ({
//       prisma: {
//           settings: { findUnique: vi.fn().mockResolvedValue({}) },
//           numberPool: {
//               findFirst: vi.fn().mockResolvedValue(null),
//               findMany:  vi.fn().mockResolvedValue([]),
//               update:    vi.fn(),
//           },
//           call:       { count: vi.fn().mockResolvedValue(0) },
//           auditLog:   { create: vi.fn() },
//           $transaction: (fn: any) => fn({ ... }),
//       },
//   }));
//
//   it("US region with empty pool returns null (no AU fallback)", async () => {
//       const { selectOutboundNumber } = await import("@/lib/number-rotation");
//       expect(await selectOutboundNumber({ region: "US" })).toBeNull();
//   });
//
//   it("propagates regionTag into prisma.numberPool.findFirst where-clause", async () => {
//       const { prisma } = await import("@/lib/prisma");
//       const { selectOutboundNumber } = await import("@/lib/number-rotation");
//       await selectOutboundNumber({ region: "US", userId: "u1" });
//       expect((prisma as any).numberPool.findFirst).toHaveBeenCalledWith(
//           expect.objectContaining({
//               where: expect.objectContaining({ regionTag: "US" }),
//           }),
//       );
//   });
//
// Skipping for now to keep this file boundary-mock-free per the brief.
// ---------------------------------------------------------------------------

describe.skip("selectOutboundNumber region filter (Prisma boundary — TODO)", () => {
    it("US region with empty pool returns null (no AU settings fallback)", () => {
        // See sketch above.
    });
    it("threads opts.region into NumberPool where-clause as regionTag", () => {
        // See sketch above.
    });
});
