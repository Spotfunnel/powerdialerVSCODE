/**
 * Pure helper: handle a failed disposition attempt.
 *
 * Extracted from DispositionPanel.tsx so the failure-recovery contract is
 * unit-testable without RTL/jsdom and so the "form stays locked after a
 * network blip" regression cannot return silently.
 *
 * The critical invariant: setSubmittedStatus(null) MUST run on every
 * failure path so the disposition buttons + notes textarea (which both
 * gate on submittedStatus) unlock for retry.
 */

export interface NotificationPayload {
    // Aligned with NotificationContext's NotificationType (success/error/info/call/sms)
    type: 'success' | 'error' | 'info' | 'call' | 'sms';
    title: string;
    message: string;
}

export interface DispositionFailureDeps {
    setSubmittedStatus: (status: string | null) => void;
    addNotification: (n: NotificationPayload) => void;
    error: unknown;
    /** Optional notification title (default: "Protocol Failed"). */
    title?: string;
    /** Optional notification message (default: standard "uplink" copy). */
    message?: string;
}

export function handleDispositionFailure(deps: DispositionFailureDeps): null {
    console.error("Disposition Refused", deps.error);
    // Unlock the form FIRST — user feedback is secondary to recoverable state.
    deps.setSubmittedStatus(null);
    deps.addNotification({
        type: 'error',
        title: deps.title ?? 'Protocol Failed',
        message: deps.message ?? "System Disconnected. Check uplink status.",
    });
    return null;
}
