import { describe, it, expect } from "vitest";

/**
 * Pin LeadStatus as having a single source of truth.
 *
 * Prior bug: src/lib/prisma.ts exported its own `LeadStatus` enum with
 * non-overlapping members (DONE, IN_CALL, BAD_NUMBER, PAUSED) that the rest
 * of the codebase doesn't recognise. Leads dispositioned to those values
 * were invisible to the acquisition query forever (see dialer-logic.ts:103).
 *
 * The canonical source is `src/lib/types.ts`. This file pins:
 *   - prisma.ts no longer exports a competing LeadStatus
 *   - the canonical enum still has the expected production members
 */

import * as PrismaModule from "@/lib/prisma";
import { LeadStatus } from "@/lib/types";

describe("LeadStatus single source of truth", () => {
    it("is NOT exported from src/lib/prisma.ts (canonical source is src/lib/types.ts)", () => {
        // Direct property access — toHaveProperty would deep-traverse the
        // prismaDirect Proxy and overflow the call stack.
        expect((PrismaModule as any).LeadStatus).toBeUndefined();
    });

    it("canonical LeadStatus exposes all production members", () => {
        // Lock down the membership set to prevent silent additions/removals.
        // If a status is added to the canonical enum, this test must be
        // updated alongside the migration that adds the matching DB CHECK.
        const expected = new Set([
            "READY",
            "LOCKED",
            "BOOKED",
            "SOLD",
            "KEY_INFO_COLLECTED",
            "ONBOARDED",
            "INTERESTED",
            "CALLBACK",
            "NO_ANSWER",
            "NOT_INTERESTED",
            "DQ",
            "ARCHIVED",
        ]);
        expect(new Set(Object.values(LeadStatus))).toEqual(expected);
    });
});
