/**
 * Parses a CSV text string into rows of fields, handling quoted fields,
 * escaped quotes (""), and embedded commas/newlines per RFC 4180.
 *
 * Behavior notes:
 * - Empty rows (rows where every field is blank/whitespace) are dropped.
 * - Trailing newlines are tolerated; a final unterminated row is still flushed.
 * - Bare CR characters are stripped (CRLF and LF both delimit rows).
 * - A doubled quote inside a quoted field ("") is unescaped to a single ".
 *
 * Extracted from src/app/api/crm/import/route.ts so the parser can be tested
 * in isolation. Keep this module dependency-free (no Prisma, no Next imports)
 * so it remains cheap to import in unit tests.
 */
export function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let current: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ',') { current.push(field); field = ""; }
            else if (ch === '\r') { /* skip */ }
            else if (ch === '\n') {
                current.push(field); field = "";
                if (current.some(f => f.trim() !== "")) rows.push(current);
                current = [];
            } else {
                field += ch;
            }
        }
    }
    // Flush last field/row
    current.push(field);
    if (current.some(f => f.trim() !== "")) rows.push(current);
    return rows;
}

/**
 * Column index map produced by `mapImportHeaders`. -1 means the column was
 * not found in the header row. Aliasing rules (case-insensitive substring
 * match) are documented per field below.
 */
export interface ImportColumnMap {
    /** matches "company" or "business" */
    company: number;
    /** matches "phone" */
    phone: number;
    /** matches "first" (e.g. "First Name") */
    first: number;
    /** matches "last" (e.g. "Last Name") */
    last: number;
    /** matches "employee" (e.g. "Employees", "# Employees") */
    employees: number;
    /** matches "priority" */
    priority: number;
    /** matches "email" */
    email: number;
    /** matches "location" (fallback for suburb when suburb/city absent) */
    location: number;
    /** matches "suburb" or "city" */
    suburb: number;
    /** matches "state" */
    state: number;
    /** matches "website" or "url" */
    website: number;
}

/**
 * Maps a CSV header row to known import columns using case-insensitive
 * substring matching. Returns -1 for any column not found.
 *
 * Extracted from src/app/api/crm/import/route.ts so the aliasing rules can be
 * characterised in tests. The route should call this helper rather than
 * duplicating the rules inline.
 */
export function mapImportHeaders(headers: string[]): ImportColumnMap {
    const lower = headers.map(h => h.toLowerCase());
    const find = (predicate: (h: string) => boolean) => lower.findIndex(predicate);
    return {
        company: find(h => h.includes("company") || h.includes("business")),
        phone: find(h => h.includes("phone")),
        first: find(h => h.includes("first")),
        last: find(h => h.includes("last")),
        employees: find(h => h.includes("employee")),
        priority: find(h => h.includes("priority")),
        email: find(h => h.includes("email")),
        location: find(h => h.includes("location")),
        suburb: find(h => h.includes("suburb") || h.includes("city")),
        state: find(h => h.includes("state")),
        website: find(h => h.includes("website") || h.includes("url")),
    };
}
