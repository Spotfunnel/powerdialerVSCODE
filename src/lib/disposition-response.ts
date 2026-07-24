/**
 * Interprets the /api/leads/[id]/status response for the disposition flow.
 *
 * `fetch` only rejects on network errors, never on a 4xx/5xx. Callers that do
 * `await res.json()` and read `.dispatch` without checking `res.ok` silently
 * treat a failed disposition as success. This helper is the single place that
 * enforces: not-ok => throw (so the caller's failure handler runs), ok =>
 * return the dispatch payload (or null). Generic to avoid importing the
 * DispositionDispatch type from LeadContext (circular).
 */
export function extractDispatch<T = any>(
    ok: boolean,
    status: number,
    body: any,
): T | null {
    if (!ok) {
        throw new Error(body?.error || `Disposition failed (${status})`);
    }
    return (body?.dispatch ?? null) as T | null;
}
