"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Device, Call } from "@twilio/voice-sdk";

interface TwilioContextType {
    deviceState: 'offline' | 'ready' | 'error' | 'reconnecting';
    deviceError: Error | null;
    activeConnection: any | null;
    activeCallDuration: number;
    incomingConnection: any | null;
    isMuted: boolean;
    dial: (phoneNumber: string) => Promise<void>;
    answer: () => void;
    reject: () => void;
    hangup: () => void;
    toggleMute: () => void;
    sendDigit: (digit: string) => void;
    outboundCallerId: string | null;
    resumeAudio: () => Promise<void>;
}

const TwilioContext = createContext<TwilioContextType | undefined>(undefined);

export function useTwilio() {
    const context = useContext(TwilioContext);
    if (!context) throw new Error("useTwilio must be used within a TwilioProvider");
    return context;
}

export function TwilioProvider({ children }: { children: ReactNode }) {
    const [deviceState, setDeviceState] = useState<'offline' | 'ready' | 'error' | 'reconnecting'>('offline');
    const [deviceError, setDeviceError] = useState<Error | null>(null);
    const [activeConnection, setActiveConnection] = useState<any | null>(null);
    const [incomingConnection, setIncomingConnection] = useState<any | null>(null);
    const [activeCallDuration, setActiveCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [outboundCallerId, setOutboundCallerId] = useState<string | null>(null);

    // Audio & Device Refs
    const ringtoneRef = useRef<HTMLAudioElement | null>(null);
    const deviceRef = useRef<Device | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);



    // --- Audio Context Helpers ---
    const handleRemoteTrack = (track: any) => {
        console.log(`[Twilio] Remote Track Detected: ${track.kind}`);
        if (track.kind === 'audio' && remoteAudioRef.current) {
            track.attach(remoteAudioRef.current);
            console.log("[Twilio] Remote Audio Attached to DOM");
        }
    };

    const resumeAudio = async () => {
        try {
            const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                if (ctx.state === 'suspended') {
                    await ctx.resume();
                    console.log("[Twilio] AudioContext Resumed Successfully");
                }
            }
        } catch (e) {
            console.warn("[Twilio] AudioContext Resume Failed:", e);
        }
    };

    // 1. Initialize Audio & Permissions (One-time)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Request Mic Permission Early
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(() => console.log("[Twilio] Mic Permission Granted Early"))
                    .catch(err => console.warn("[Twilio] Mic Permission Denied or Not Supported", err));
            }

            try {
                const audio = new Audio("https://cdn.freesound.org/previews/286/286909_4703554-lq.mp3");
                audio.loop = true;
                ringtoneRef.current = audio;
                if ("Notification" in window && Notification.permission !== "granted") {
                    Notification.requestPermission();
                }
            } catch (e) {
                console.warn("Audio init failed:", e);
            }
        }
    }, []);

    // 2. Initialize Twilio Device
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const initDevice = async () => {
            console.log("[Twilio] Initializing Device...");
            setDeviceState('offline');

            try {
                console.log("[Twilio] Fetching device token from /api/voice/token...");
                const res = await fetch("/api/voice/token", { method: "POST" });
                if (!res.ok) {
                    const errorText = await res.text();
                    console.error(`[Twilio] Token fetch failed (${res.status}): ${errorText}`);
                    throw new Error("Failed to fetch token");
                }
                const data = await res.json();

                if (!data.token) {
                    console.error("[Twilio] No token returned");
                    return;
                }

                const device = new Device(data.token, {
                    codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
                    enableRingingState: true,
                    edge: ['sydney', 'ashburn', 'roaming'],
                    maxCallSignalingTimeoutMs: 30000
                } as any);

                device.on("unregistered", () => {
                    console.log("[Twilio] Device Unregistered");
                    setDeviceState('offline');
                });

                device.on("registered", () => {
                    console.log("[Twilio] Device Registered");
                    setDeviceState('ready');
                    setDeviceError(null);

                    // Token Refresh (50 minutes)
                    setTimeout(async () => {
                        console.log("[Twilio] Refreshing Token...");
                        try {
                            const res = await fetch("/api/voice/token", { method: "POST" });
                            if (res.ok) {
                                const data = await res.json();
                                device.updateToken(data.token);
                            }
                        } catch (e) {
                            console.error("[Twilio] Token refresh failed", e);
                        }
                    }, 50 * 60 * 1000);
                });

                device.on("error", (err) => {
                    console.error("[Twilio] Device Error:", err);
                    setDeviceState('error');
                    setDeviceError(err);
                });

                device.on("incoming", (conn) => {
                    console.log("[Twilio] Incoming Call:", conn.parameters);
                    setIncomingConnection(conn);

                    // Listen for remote tracks (SDK v2 method)
                    conn.on('track', handleRemoteTrack);

                    // Play ringtone
                    const playAudio = async () => {
                        try {
                            if (ringtoneRef.current) {
                                ringtoneRef.current.currentTime = 0;
                                await ringtoneRef.current.play();
                            }
                        } catch (e) {
                            console.warn("[Twilio] Autoplay blocked or failed:", e);
                        }
                    };
                    playAudio();

                    // Vibrate
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate([500, 200, 500, 200, 500]);
                    }

                    conn.on("disconnect", () => {
                        console.log("[Twilio] Incoming/Active Connection Disconnected");
                        setIncomingConnection(null);
                        setActiveConnection(null);
                        ringtoneRef.current?.pause();
                        if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
                    });

                    conn.on("accept", () => {
                        console.log("[Twilio] Call Accepted - Moving to Active State");
                        setActiveConnection(conn);
                        setIncomingConnection(null);
                        ringtoneRef.current?.pause();
                        if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
                        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(0);
                    });

                    conn.on("error", (err: any) => {
                        console.error("[Twilio] Connection Error:", err);
                        setIncomingConnection(null);
                        setActiveConnection(null);
                    });
                });

                await device.register();
                deviceRef.current = device;

            } catch (err: any) {
                console.error("[Twilio] Init Failed:", err);
                setDeviceState('error');
                setDeviceError(err);
            }
        };

        initDevice();

        return () => {
            deviceRef.current?.destroy();
            deviceRef.current = null;
        };
    }, []);

    // Call Duration Timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (activeConnection) {
            setActiveCallDuration(0);
            interval = setInterval(() => {
                setActiveCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            setActiveCallDuration(0);
        }
        return () => clearInterval(interval);
    }, [activeConnection]);

    // --- Actions ---

    const dial = async (phoneNumber: string) => {
        await resumeAudio();
        if (!deviceRef.current) {
            alert("Device not ready (Leader needed). Please refresh the page.");
            return;
        }

        const device = deviceRef.current;
        try {
            const identity = (deviceRef.current as any)?._tokenPayload?.identity || null;
            fetch(`/api/voice/lookup-caller?to=${encodeURIComponent(phoneNumber)}${identity ? `&userId=${identity}` : ""}`)
                .then(res => res.json())
                .then(data => {
                    if (data.callerId) setOutboundCallerId(data.callerId);
                })
                .catch(err => console.error("Failed to lookup caller ID", err));

            const connection = await device.connect({ params: { To: phoneNumber, userId: identity } });

            // Listen for remote tracks for outbound calls
            connection.on('track', handleRemoteTrack);

            setActiveConnection(connection);
            connection.on("disconnect", () => {
                setActiveConnection(null);
                setOutboundCallerId(null);
            });
            connection.on("error", (err) => {
                console.error("Call error:", err);
                setActiveConnection(null);
                setOutboundCallerId(null);
            });
        } catch (e) {
            console.error("Dial failed:", e);
            setOutboundCallerId(null);
        }
    };

    const answer = async () => {
        await resumeAudio();
        if (incomingConnection) {
            try {
                console.log("[Twilio] Attempting to accept connection...");
                // Optimistic state update to clear UI immediately
                setActiveConnection(incomingConnection);
                setIncomingConnection(null);

                incomingConnection.accept();
            } catch (e) {
                console.error("[Twilio] Accept failed:", e);
                setIncomingConnection(null);
                setActiveConnection(null);
            }
        }
    };

    const reject = async () => {
        await resumeAudio();
        if (incomingConnection) {
            incomingConnection.reject();
        }
    };

    const hangup = () => {
        if (activeConnection) {
            activeConnection.disconnect();
        } else if (incomingConnection) {
            incomingConnection.reject();
        }
    };

    const toggleMute = () => {
        if (activeConnection) {
            const newVal = !activeConnection.isMuted();
            activeConnection.mute(newVal);
            setIsMuted(newVal);
        }
    };

    const sendDigit = (digit: string) => {
        if (activeConnection) {
            activeConnection.sendDigits(digit);
        }
    };

    // Keep-alive heartbeat for PWA
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const interval = setInterval(() => {
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage('keepAlive');
            }
        }, 20000); // Ping every 20 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <TwilioContext.Provider value={{
            deviceState,
            deviceError,
            activeConnection,
            activeCallDuration,
            incomingConnection,
            isMuted,
            dial,
            answer,
            reject,
            hangup,
            toggleMute,
            sendDigit,
            outboundCallerId,
            resumeAudio
        }}>
            {children}
            <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
        </TwilioContext.Provider>
    );
}
