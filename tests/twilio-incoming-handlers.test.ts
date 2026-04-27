import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { attachIncomingCallHandlers } from "@/lib/twilio-incoming";

/**
 * Tests for attachIncomingCallHandlers — the pure helper extracted from
 * TwilioContext.tsx that wires Twilio Voice SDK Connection events to
 * React state callbacks.
 *
 * Bug being driven out: TwilioContext.tsx subscribed to 'disconnect',
 * 'accept', and 'error' on incoming connections — but NOT 'cancel'.
 * Twilio fires `cancel` when the remote party hangs up before the rep
 * answers. Without that handler, `incomingConnection` state stays
 * populated, ringtone keeps looping, overlay never dismisses.
 *
 * The helper now registers all four events. These tests pin the contract.
 */

type FakeConn = EventEmitter;

function makeConn(): FakeConn {
    return new EventEmitter();
}

describe("attachIncomingCallHandlers", () => {
    it("calls onDisconnect when the connection emits 'disconnect'", () => {
        const conn = makeConn();
        const cbs = {
            onAccept: vi.fn(), onDisconnect: vi.fn(),
            onError: vi.fn(), onCancel: vi.fn(),
        };
        attachIncomingCallHandlers(conn as any, cbs);
        conn.emit("disconnect");
        expect(cbs.onDisconnect).toHaveBeenCalledTimes(1);
        expect(cbs.onCancel).not.toHaveBeenCalled();
    });

    it("calls onAccept when the connection emits 'accept' and forwards the connection", () => {
        const conn = makeConn();
        const cbs = {
            onAccept: vi.fn(), onDisconnect: vi.fn(),
            onError: vi.fn(), onCancel: vi.fn(),
        };
        attachIncomingCallHandlers(conn as any, cbs);
        conn.emit("accept");
        expect(cbs.onAccept).toHaveBeenCalledTimes(1);
        expect(cbs.onAccept).toHaveBeenCalledWith(conn);
    });

    it("calls onError when the connection emits 'error' with the error payload", () => {
        const conn = makeConn();
        const cbs = {
            onAccept: vi.fn(), onDisconnect: vi.fn(),
            onError: vi.fn(), onCancel: vi.fn(),
        };
        attachIncomingCallHandlers(conn as any, cbs);
        const err = new Error("boom");
        conn.emit("error", err);
        expect(cbs.onError).toHaveBeenCalledWith(err);
    });

    it("calls onCancel when the connection emits 'cancel' (the bug being fixed)", () => {
        const conn = makeConn();
        const cbs = {
            onAccept: vi.fn(), onDisconnect: vi.fn(),
            onError: vi.fn(), onCancel: vi.fn(),
        };
        attachIncomingCallHandlers(conn as any, cbs);
        conn.emit("cancel");
        expect(cbs.onCancel).toHaveBeenCalledTimes(1);
        expect(cbs.onDisconnect).not.toHaveBeenCalled();
    });

    it("registers exactly one listener per event (no double-registration)", () => {
        const conn = makeConn();
        attachIncomingCallHandlers(conn as any, {
            onAccept: vi.fn(), onDisconnect: vi.fn(),
            onError: vi.fn(), onCancel: vi.fn(),
        });
        expect(conn.listenerCount("accept")).toBe(1);
        expect(conn.listenerCount("disconnect")).toBe(1);
        expect(conn.listenerCount("error")).toBe(1);
        expect(conn.listenerCount("cancel")).toBe(1);
    });
});
