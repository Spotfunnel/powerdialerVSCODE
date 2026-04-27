import { describe, it, expect, vi } from "vitest";

// `src/lib/leads.ts` imports `./prisma` at module scope, which would spin up a
// real PrismaClient (and require DATABASE_URL). Mock it so importing
// `normalizePhone` stays a pure-function test.
vi.mock("@/lib/prisma", () => ({
    prisma: {},
    prismaDirect: {},
}));

import { normalizePhone } from "@/lib/leads";
import { parseCSV, mapImportHeaders } from "@/lib/csv-parse";

// ---------------------------------------------------------------------------
// normalizePhone — variant generation for legacy-format matching
// ---------------------------------------------------------------------------

describe("normalizePhone — AU mobile variant generation", () => {
    it("0412345678 yields local, +61 and 61 variants", () => {
        const variants = normalizePhone("0412345678");
        expect(variants).toContain("0412345678");
        expect(variants).toContain("+61412345678");
        expect(variants).toContain("614123456 78".replace(" ", "")); // "614123456 78" -> "61412345678"
    });

    it("+61412345678 yields local 04, bare 614 and E.164 variants", () => {
        const variants = normalizePhone("+61412345678");
        expect(variants).toContain("+61412345678");
        expect(variants).toContain("0412345678");
        expect(variants).toContain("61412345678");
    });

    it("614123456 78 -> 61412345678 yields all three AU forms", () => {
        const variants = normalizePhone("61412345678");
        expect(variants).toContain("61412345678");
        expect(variants).toContain("+61412345678");
        expect(variants).toContain("0412345678");
    });

    it("formatted AU mobile (with spaces) still yields E.164 + local + bare", () => {
        const variants = normalizePhone("0412 345 678");
        expect(variants).toContain("+61412345678");
        expect(variants).toContain("0412345678");
        expect(variants).toContain("61412345678");
    });

    it("returns no duplicate values", () => {
        const variants = normalizePhone("+61412345678");
        expect(new Set(variants).size).toBe(variants.length);
    });
});

describe("normalizePhone — AU landline variant generation", () => {
    it("0298765432 (Sydney landline) yields E.164 form among variants", () => {
        const variants = normalizePhone("0298765432");
        // The 04-mobile branch must NOT fire — landline starts with 02.
        expect(variants.some(v => v.startsWith("+614"))).toBe(false);
        expect(variants).toContain("+61298765432");
        // raw digits remain available for legacy matching
        expect(variants).toContain("0298765432");
    });

    it("+61298765432 includes raw digits and the +61 form", () => {
        const variants = normalizePhone("+61298765432");
        expect(variants).toContain("+61298765432");
        expect(variants).toContain("61298765432");
    });
});

describe("normalizePhone — US variant generation", () => {
    it("+18504390035 yields +1, 1-prefixed, and bare 10-digit variants", () => {
        const variants = normalizePhone("+18504390035");
        expect(variants).toContain("+18504390035");
        expect(variants).toContain("18504390035");
        expect(variants).toContain("8504390035");
    });

    it("8504390035 (bare 10-digit US) normalizes through E.164 to all three forms", () => {
        const variants = normalizePhone("8504390035");
        expect(variants).toContain("8504390035");
        expect(variants).toContain("+18504390035");
        expect(variants).toContain("18504390035");
    });

    it("18504390035 (1-prefixed US) yields all three forms", () => {
        const variants = normalizePhone("18504390035");
        expect(variants).toContain("18504390035");
        expect(variants).toContain("+18504390035");
        expect(variants).toContain("8504390035");
    });

    it("AU and US variants do not collide", () => {
        const auVariants = normalizePhone("+61412345678");
        const usVariants = normalizePhone("+18504390035");
        // No AU variant should accidentally appear in the US set or vice versa
        for (const v of auVariants) expect(usVariants).not.toContain(v);
    });
});

describe("normalizePhone — invalid / edge inputs", () => {
    it("empty string returns an empty array", () => {
        expect(normalizePhone("")).toEqual([]);
    });

    it("non-numeric input returns at least the original string (no crash)", () => {
        const variants = normalizePhone("not-a-number");
        // Must not throw and must not contain empty strings.
        expect(variants).toContain("not-a-number");
        expect(variants).not.toContain("");
    });

    it("does not include empty strings even when only one form is derivable", () => {
        // "+" alone has no digits — should not produce empty-string variants.
        const variants = normalizePhone("+");
        for (const v of variants) expect(v).not.toBe("");
    });

    it("strings containing only formatting chars produce no garbage variants", () => {
        const variants = normalizePhone("()-  ");
        for (const v of variants) expect(v.length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// parseCSV — RFC 4180 behavior
// ---------------------------------------------------------------------------

describe("parseCSV — plain rows", () => {
    it("parses a simple two-row CSV", () => {
        const text = "a,b,c\n1,2,3";
        expect(parseCSV(text)).toEqual([
            ["a", "b", "c"],
            ["1", "2", "3"],
        ]);
    });

    it("parses with a trailing newline", () => {
        const text = "a,b\n1,2\n";
        expect(parseCSV(text)).toEqual([
            ["a", "b"],
            ["1", "2"],
        ]);
    });

    it("parses without a trailing newline", () => {
        const text = "a,b\n1,2";
        expect(parseCSV(text)).toEqual([
            ["a", "b"],
            ["1", "2"],
        ]);
    });

    it("handles CRLF line endings (strips bare \\r)", () => {
        const text = "a,b\r\n1,2\r\n";
        expect(parseCSV(text)).toEqual([
            ["a", "b"],
            ["1", "2"],
        ]);
    });
});

describe("parseCSV — quoted fields", () => {
    it("preserves embedded commas inside quoted fields", () => {
        const text = 'name,company\nJane,"Acme, Inc."';
        expect(parseCSV(text)).toEqual([
            ["name", "company"],
            ["Jane", "Acme, Inc."],
        ]);
    });

    it('unescapes doubled quotes ("" -> ") inside quoted fields', () => {
        const text = 'name,nickname\nJane,"She said ""hi"""';
        expect(parseCSV(text)).toEqual([
            ["name", "nickname"],
            ["Jane", 'She said "hi"'],
        ]);
    });

    it("preserves newlines inside quoted fields", () => {
        const text = 'name,address\nJane,"123 Main St\nApt 4"';
        expect(parseCSV(text)).toEqual([
            ["name", "address"],
            ["Jane", "123 Main St\nApt 4"],
        ]);
    });

    it("handles quoted field at end of row with no trailing newline", () => {
        const text = 'a,b\n1,"hello"';
        expect(parseCSV(text)).toEqual([
            ["a", "b"],
            ["1", "hello"],
        ]);
    });

    it("handles consecutive quoted fields", () => {
        const text = 'a,b,c\n"x","y, z","w"';
        expect(parseCSV(text)).toEqual([
            ["a", "b", "c"],
            ["x", "y, z", "w"],
        ]);
    });
});

describe("parseCSV — empty fields and blank rows", () => {
    it("preserves empty fields between commas", () => {
        const text = "a,b,c\n1,,3";
        expect(parseCSV(text)).toEqual([
            ["a", "b", "c"],
            ["1", "", "3"],
        ]);
    });

    it("preserves trailing empty field", () => {
        const text = "a,b,c\n1,2,";
        expect(parseCSV(text)).toEqual([
            ["a", "b", "c"],
            ["1", "2", ""],
        ]);
    });

    it("preserves leading empty field", () => {
        const text = "a,b,c\n,2,3";
        expect(parseCSV(text)).toEqual([
            ["a", "b", "c"],
            ["", "2", "3"],
        ]);
    });

    it("drops fully blank rows (rows with only whitespace fields)", () => {
        const text = "a,b\n1,2\n\n3,4\n";
        expect(parseCSV(text)).toEqual([
            ["a", "b"],
            ["1", "2"],
            ["3", "4"],
        ]);
    });

    it("returns an empty array for an empty input", () => {
        expect(parseCSV("")).toEqual([]);
    });

    it("returns an empty array for whitespace-only input", () => {
        // Newlines and spaces produce only blank rows, which are dropped.
        expect(parseCSV("\n\n  \n")).toEqual([]);
    });
});

describe("parseCSV — combined fixtures", () => {
    it("handles a realistic import row mixing quoted commas, escaped quotes and a trailing newline", () => {
        const text = [
            'company,phone,notes',
            '"Acme, Inc.",0412345678,"called ""back"" today"',
            '"Beta Co",+18504390035,plain note',
            '',
        ].join("\n");
        expect(parseCSV(text)).toEqual([
            ["company", "phone", "notes"],
            ["Acme, Inc.", "0412345678", 'called "back" today'],
            ["Beta Co", "+18504390035", "plain note"],
        ]);
    });
});

// ---------------------------------------------------------------------------
// mapImportHeaders — column aliasing
// ---------------------------------------------------------------------------

describe("mapImportHeaders — basic column detection", () => {
    it("maps canonical headers to their indices", () => {
        const headers = [
            "Company", "Phone", "First Name", "Last Name",
            "Employees", "Priority", "Email", "Suburb", "State", "Website",
        ];
        const colMap = mapImportHeaders(headers);
        expect(colMap.company).toBe(0);
        expect(colMap.phone).toBe(1);
        expect(colMap.first).toBe(2);
        expect(colMap.last).toBe(3);
        expect(colMap.employees).toBe(4);
        expect(colMap.priority).toBe(5);
        expect(colMap.email).toBe(6);
        expect(colMap.suburb).toBe(7);
        expect(colMap.state).toBe(8);
        expect(colMap.website).toBe(9);
    });

    it("returns -1 for missing columns", () => {
        const colMap = mapImportHeaders(["Phone"]);
        expect(colMap.phone).toBe(0);
        expect(colMap.company).toBe(-1);
        expect(colMap.first).toBe(-1);
        expect(colMap.email).toBe(-1);
        expect(colMap.suburb).toBe(-1);
        expect(colMap.website).toBe(-1);
    });

    it("matches headers case-insensitively", () => {
        const colMap = mapImportHeaders(["PHONE", "EMAIL"]);
        expect(colMap.phone).toBe(0);
        expect(colMap.email).toBe(1);
    });

    it("matches header substrings (e.g. 'Mobile Phone Number')", () => {
        const colMap = mapImportHeaders(["Mobile Phone Number", "Primary Email Address"]);
        expect(colMap.phone).toBe(0);
        expect(colMap.email).toBe(1);
    });
});

describe("mapImportHeaders — aliasing", () => {
    it("treats 'Business' as an alias for company", () => {
        const colMap = mapImportHeaders(["Business Name", "Phone"]);
        expect(colMap.company).toBe(0);
    });

    it("still recognises 'Company' literally", () => {
        const colMap = mapImportHeaders(["Company Name", "Phone"]);
        expect(colMap.company).toBe(0);
    });

    it("treats 'City' as an alias for suburb", () => {
        const colMap = mapImportHeaders(["Phone", "City"]);
        expect(colMap.suburb).toBe(1);
    });

    it("still recognises 'Suburb' literally", () => {
        const colMap = mapImportHeaders(["Phone", "Suburb"]);
        expect(colMap.suburb).toBe(1);
    });

    it("treats 'URL' as an alias for website", () => {
        const colMap = mapImportHeaders(["Phone", "URL"]);
        expect(colMap.website).toBe(1);
    });

    it("still recognises 'Website' literally", () => {
        const colMap = mapImportHeaders(["Phone", "Website"]);
        expect(colMap.website).toBe(1);
    });

    it("location is independent of suburb (kept separate so route can fall back)", () => {
        const colMap = mapImportHeaders(["Phone", "Location"]);
        expect(colMap.location).toBe(1);
        expect(colMap.suburb).toBe(-1);
    });

    it("when both Suburb and City are present, the first match wins", () => {
        const colMap = mapImportHeaders(["Phone", "Suburb", "City"]);
        expect(colMap.suburb).toBe(1);
    });
});
