"use client";

/**
 * E2E test harness for GlobalCallNotification.
 *
 * Mounts the component with a controllable mock TwilioContext. Playwright
 * drives the harness via a window-exposed API to simulate incoming and
 * active call states without spinning up real Twilio infrastructure.
 *
 * Only built outside production. The route is gated on NODE_ENV so it
 * 404s in production builds.
 */

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { TwilioContext } from "@/contexts/TwilioContext";
import { GlobalCallNotification } from "@/components/GlobalCallNotification";
import { performHangup } from "@/lib/twilio-hangup";

declare global {
    interface Window {
        __E2E_TWILIO__?: {
            simulateIncoming: (parameters?: Record<string, string>) => void;
            simulateActive: () => void;
            getState: () => { active: boolean; incoming: boolean; lastDisconnectCalled: number; lastRejectCalled: number };
            reset: () => void;
        };
    }
}

export default function CallNotificationHarness() {
    if (process.env.NODE_ENV === "production") notFound();

    const [activeConnection, setActiveConnection] = useState<any | null>(null);
    const [incomingConnection, setIncomingConnection] = useState<any | null>(null);
    const [disconnectCount, setDisconnectCount] = useState(0);
    const [rejectCount, setRejectCount] = useState(0);

    // Build a stable mock connection factory so the harness can simulate
    // SDK-call counts without re-renders generating new objects each tick.
    function makeFakeConn(parameters: Record<string, string> = {}) {
        return {
            parameters,
            customParameters: new Map(Object.entries(parameters)),
            disconnect: () => setDisconnectCount(c => c + 1),
            reject: () => setRejectCount(c => c + 1),
            isMuted: () => false,
            mute: () => { },
            sendDigits: () => { },
        };
    }

    const ctxValue = {
        deviceState: "ready" as const,
        deviceError: null,
        activeConnection,
        activeCallDuration: 0,
        incomingConnection,
        isMuted: false,
        dial: async () => { },
        answer: () => {
            if (incomingConnection) {
                setActiveConnection(incomingConnection);
                setIncomingConnection(null);
            }
        },
        reject: () => {
            const next = performHangup(null, incomingConnection);
            setIncomingConnection(next.incomingConnection);
        },
        hangup: () => {
            const next = performHangup(activeConnection, incomingConnection);
            setActiveConnection(next.activeConnection);
            setIncomingConnection(next.incomingConnection);
        },
        toggleMute: () => { },
        sendDigit: () => { },
        outboundCallerId: null,
        resumeAudio: async () => { },
    };

    useEffect(() => {
        window.__E2E_TWILIO__ = {
            simulateIncoming: (params = { callerName: "Test Caller", callerCompany: "Acme Co" }) => {
                setIncomingConnection(makeFakeConn(params));
            },
            simulateActive: () => {
                setActiveConnection(makeFakeConn({ From: "+15551234567" }));
            },
            getState: () => ({
                active: !!activeConnection,
                incoming: !!incomingConnection,
                lastDisconnectCalled: disconnectCount,
                lastRejectCalled: rejectCount,
            }),
            reset: () => {
                setActiveConnection(null);
                setIncomingConnection(null);
                setDisconnectCount(0);
                setRejectCount(0);
            },
        };
        return () => { delete window.__E2E_TWILIO__; };
    }, [activeConnection, incomingConnection, disconnectCount, rejectCount]);

    return (
        <TwilioContext.Provider value={ctxValue as any}>
            <div data-testid="harness-root" className="p-8 bg-zinc-100 min-h-screen">
                <h1 className="text-xl font-bold mb-2">E2E Harness — Call Notification</h1>
                <pre data-testid="state" className="bg-white p-3 rounded text-xs">
                    {JSON.stringify({
                        incoming: !!incomingConnection,
                        active: !!activeConnection,
                        disconnectCount,
                        rejectCount,
                    }, null, 2)}
                </pre>
                <GlobalCallNotification />
            </div>
        </TwilioContext.Provider>
    );
}
