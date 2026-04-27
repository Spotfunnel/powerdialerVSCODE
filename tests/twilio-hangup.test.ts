import { describe, it, expect, vi } from "vitest";
import { performHangup } from "@/lib/twilio-hangup";

/**
 * Pure-logic tests for the hangup state machine.
 *
 * Why this exists: previously `hangup()` in TwilioContext called
 * `activeConnection.disconnect()` and relied on `connection.on('disconnect')`
 * firing to clear the React state. If the SDK didn't fire that event
 * (network blip, already-dead connection, race), the UI stayed stuck on
 * the active-call overlay even though the disconnect call had been issued.
 *
 * The fix: hangup eagerly returns a state-update payload that callers
 * apply unconditionally. Disconnect/reject calls are still made; the UI
 * no longer depends on the SDK callback to update.
 */

type FakeConn = {
    disconnect: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
};

function makeConn(): FakeConn {
    return { disconnect: vi.fn(), reject: vi.fn() };
}

describe("performHangup", () => {
    it("disconnects the active connection and returns cleared state", () => {
        const active = makeConn();
        const result = performHangup(active as any, null);
        expect(active.disconnect).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ activeConnection: null, incomingConnection: null });
    });

    it("rejects the incoming connection when no active connection exists", () => {
        const incoming = makeConn();
        const result = performHangup(null, incoming as any);
        expect(incoming.reject).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ activeConnection: null, incomingConnection: null });
    });

    it("prefers active over incoming when both are non-null (active call wins)", () => {
        const active = makeConn();
        const incoming = makeConn();
        performHangup(active as any, incoming as any);
        expect(active.disconnect).toHaveBeenCalledTimes(1);
        expect(incoming.reject).not.toHaveBeenCalled();
    });

    it("returns cleared state even when SDK disconnect throws (UI must unstick)", () => {
        const active = { disconnect: vi.fn(() => { throw new Error("SDK already dead"); }) };
        const result = performHangup(active as any, null);
        expect(result).toEqual({ activeConnection: null, incomingConnection: null });
    });

    it("returns cleared state when SDK reject throws", () => {
        const incoming = { reject: vi.fn(() => { throw new Error("Already rejected"); }) };
        const result = performHangup(null, incoming as any);
        expect(result).toEqual({ activeConnection: null, incomingConnection: null });
    });

    it("returns cleared state when both connections are null (no-op safe)", () => {
        const result = performHangup(null, null);
        expect(result).toEqual({ activeConnection: null, incomingConnection: null });
    });
});
