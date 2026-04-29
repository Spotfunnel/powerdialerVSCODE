/**
 * Pure helpers for the dialer mic-picker. Kept dependency-free so it can be
 * unit-tested without spinning up the Twilio Voice SDK or browser DOM.
 *
 * The picker stores the chosen mic in sessionStorage (per spec: clears on
 * tab close). On Twilio Device init, the saved id is run through
 * `pickInputDevice` against the live `device.audio.availableInputDevices`
 * map. If the saved device is gone (unplugged, different machine), the
 * helper returns null and the caller falls back to the browser default.
 */

export const MIC_STORAGE_KEY = "powerdialer:micDeviceId";

export interface DeviceLike {
    deviceId: string;
}

/**
 * Choose which input deviceId to apply at session start.
 * Returns the saved id if (and only if) it appears in `available`.
 * Returns null otherwise — the caller should let the browser pick a default.
 */
export function pickInputDevice(
    savedId: string | null | undefined,
    available: ReadonlyArray<DeviceLike>,
): string | null {
    if (!savedId) return null;
    return available.some(d => d.deviceId === savedId) ? savedId : null;
}
