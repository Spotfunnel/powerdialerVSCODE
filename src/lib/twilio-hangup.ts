type HangupableConnection = {
    disconnect?: () => void;
    reject?: () => void;
};

export type HangupResult = {
    activeConnection: null;
    incomingConnection: null;
};

/**
 * Pure hangup logic shared by the TwilioContext.
 *
 * Calls disconnect() on the active connection (preferred) or reject() on
 * the incoming connection, then returns a cleared-state payload that the
 * caller applies unconditionally. The cleared state must be applied even
 * if the SDK call throws — the UI cannot get stuck on a dead call just
 * because the SDK is in a weird state.
 */
export function performHangup(
    activeConnection: HangupableConnection | null,
    incomingConnection: HangupableConnection | null,
): HangupResult {
    if (activeConnection) {
        try {
            activeConnection.disconnect?.();
        } catch (err) {
            console.warn("[Twilio] disconnect() threw, clearing state anyway:", err);
        }
    } else if (incomingConnection) {
        try {
            incomingConnection.reject?.();
        } catch (err) {
            console.warn("[Twilio] reject() threw, clearing state anyway:", err);
        }
    }
    return { activeConnection: null, incomingConnection: null };
}
