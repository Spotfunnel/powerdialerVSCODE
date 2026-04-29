"use client";

/**
 * E2E test harness for MicPicker.
 *
 * Mounts MicPicker against a controllable mock TwilioContext. Playwright
 * drives every scenario through `window.__E2E_MIC__`:
 *
 *   - simulateDevices(list) — replace the available-input list (sim plug/unplug)
 *   - getState() — read the harness's current persisted/active state
 *   - clearStorage() — wipe sessionStorage between scenarios
 *   - failNextSet() — make the next setInputDevice call reject (sim hardware refusal)
 *
 * Production-gated: the page 404s when NODE_ENV === "production".
 */

import { useEffect, useState, useCallback } from "react";
import { notFound } from "next/navigation";
import { TwilioContext, AudioInputDevice } from "@/contexts/TwilioContext";
import { MIC_STORAGE_KEY } from "@/lib/mic-picker";
import { MicPicker } from "@/components/dialer/MicPicker";

declare global {
    interface Window {
        __E2E_MIC__?: {
            simulateDevices: (devices: AudioInputDevice[]) => void;
            getState: () => { active: string | null; available: AudioInputDevice[]; saved: string | null; setCalls: { deviceId: string; ok: boolean }[] };
            clearStorage: () => void;
            failNextSet: () => void;
        };
    }
}

export default function MicPickerHarness() {
    if (process.env.NODE_ENV === "production") notFound();

    const [available, setAvailable] = useState<AudioInputDevice[]>([
        { deviceId: "mic-internal", label: "MacBook Air Microphone" },
        { deviceId: "mic-headset", label: "Logitech Headset H390" },
        { deviceId: "mic-usb", label: "Blue Yeti USB" },
    ]);
    const [active, setActive] = useState<string | null>(null);
    const [shouldFailNextSet, setShouldFailNextSet] = useState(false);
    const [setCalls, setSetCalls] = useState<{ deviceId: string; ok: boolean }[]>([]);

    // Restore from sessionStorage so refresh-survival can be verified.
    useEffect(() => {
        const saved = window.sessionStorage.getItem(MIC_STORAGE_KEY);
        if (saved && available.some(d => d.deviceId === saved)) {
            setActive(saved);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setInputDevice = useCallback(async (deviceId: string) => {
        if (shouldFailNextSet) {
            setShouldFailNextSet(false);
            setSetCalls(prev => [...prev, { deviceId, ok: false }]);
            throw new Error("simulated hardware refusal");
        }
        setActive(deviceId);
        window.sessionStorage.setItem(MIC_STORAGE_KEY, deviceId);
        setSetCalls(prev => [...prev, { deviceId, ok: true }]);
    }, [shouldFailNextSet]);

    const ctx = {
        deviceState: "ready" as const,
        deviceError: null,
        activeConnection: null,
        activeCallDuration: 0,
        incomingConnection: null,
        isMuted: false,
        dial: async () => { },
        answer: () => { },
        reject: () => { },
        hangup: () => { },
        toggleMute: () => { },
        sendDigit: () => { },
        outboundCallerId: null,
        resumeAudio: async () => { },
        availableInputDevices: available,
        inputDeviceId: active,
        setInputDevice,
    };

    useEffect(() => {
        window.__E2E_MIC__ = {
            simulateDevices: (list) => {
                setAvailable(list);
                // If active deviceId is no longer in the list, clear it
                setActive(prev => prev && list.some(d => d.deviceId === prev) ? prev : null);
            },
            getState: () => ({
                active,
                available,
                saved: window.sessionStorage.getItem(MIC_STORAGE_KEY),
                setCalls,
            }),
            clearStorage: () => {
                window.sessionStorage.removeItem(MIC_STORAGE_KEY);
                setActive(null);
                setSetCalls([]);
            },
            failNextSet: () => setShouldFailNextSet(true),
        };
        return () => { delete window.__E2E_MIC__; };
    }, [active, available, setCalls]);

    return (
        <TwilioContext.Provider value={ctx as any}>
            <div data-testid="harness-root" className="p-8 bg-zinc-100 min-h-screen">
                <h1 className="text-xl font-bold mb-4">E2E Harness — MicPicker</h1>
                <pre data-testid="harness-state" className="bg-white p-3 rounded text-xs mb-4 overflow-auto">
                    {JSON.stringify({
                        active,
                        available: available.map(d => d.deviceId),
                        saved: typeof window !== "undefined" ? window.sessionStorage.getItem(MIC_STORAGE_KEY) : null,
                        setCallCount: setCalls.length,
                    }, null, 2)}
                </pre>
                <div className="bg-white border border-zinc-200 rounded-lg p-4 inline-block">
                    <MicPicker />
                </div>
            </div>
        </TwilioContext.Provider>
    );
}
