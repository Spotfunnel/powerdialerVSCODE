/**
 * Pure helper: wire Twilio Voice SDK incoming-Connection events to React-state
 * callbacks. Extracted from TwilioContext.tsx so the event-wiring contract is
 * unit-testable without React/jsdom and so a missing handler (e.g., 'cancel')
 * can no longer regress silently.
 *
 * The four events covered:
 *   - 'accept'      → user picked up the call locally
 *   - 'disconnect'  → call ended after being connected
 *   - 'error'       → SDK error during the call
 *   - 'cancel'      → caller hung up BEFORE the rep answered (was missing,
 *                     causing the "stuck ringtone / overlay never dismisses"
 *                     bug)
 */

export interface IncomingCallCallbacks {
    onAccept: (conn: TwilioConnectionLike) => void;
    onDisconnect: () => void;
    onError: (err: any) => void;
    onCancel: () => void;
}

export interface TwilioConnectionLike {
    on(event: string, handler: (...args: any[]) => void): void;
}

export function attachIncomingCallHandlers(
    conn: TwilioConnectionLike,
    cbs: IncomingCallCallbacks,
): void {
    conn.on("accept", () => cbs.onAccept(conn));
    conn.on("disconnect", () => cbs.onDisconnect());
    conn.on("error", (err: any) => cbs.onError(err));
    conn.on("cancel", () => cbs.onCancel());
}
