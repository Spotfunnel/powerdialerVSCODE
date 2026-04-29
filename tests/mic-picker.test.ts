import { describe, it, expect } from "vitest";
import { pickInputDevice } from "@/lib/mic-picker";

describe("pickInputDevice", () => {
    it("returns the saved deviceId when it's still available", () => {
        const result = pickInputDevice("mic-1", [
            { deviceId: "mic-1", label: "Internal Mic" },
            { deviceId: "mic-2", label: "USB Headset" },
        ]);
        expect(result).toBe("mic-1");
    });

    it("returns null when the saved deviceId is no longer in the available list (unplugged / different machine)", () => {
        const result = pickInputDevice("mic-gone", [
            { deviceId: "mic-1" },
            { deviceId: "mic-2" },
        ]);
        expect(result).toBeNull();
    });

    it("returns null when there is no saved deviceId yet (first visit)", () => {
        expect(pickInputDevice(null, [{ deviceId: "mic-1" }])).toBeNull();
        expect(pickInputDevice(undefined, [{ deviceId: "mic-1" }])).toBeNull();
        expect(pickInputDevice("", [{ deviceId: "mic-1" }])).toBeNull();
    });

    it("returns null when no input devices are available at all", () => {
        expect(pickInputDevice("mic-1", [])).toBeNull();
    });
});
