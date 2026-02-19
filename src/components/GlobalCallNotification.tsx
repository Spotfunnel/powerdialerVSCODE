"use client";

import { useTwilio } from "@/contexts/TwilioContext";
import { Phone, PhoneOff, Mic, MicOff, Grid3x3, Grip, Maximize2, Minimize2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function GlobalCallNotification() {
    const { incomingConnection, answer, reject, activeConnection, activeCallDuration, hangup, toggleMute, isMuted, sendDigit, outboundCallerId, resumeAudio } = useTwilio();
    const [minimized, setMinimized] = useState(false);
    const [showKeypad, setShowKeypad] = useState(false);

    // If no active call and no incoming call, return null
    if (!incomingConnection && !activeConnection) return null;

    // --- INCOMING CALL STATE ---
    if (incomingConnection && !activeConnection) {
        const params = incomingConnection.parameters || {};
        const customParams = (incomingConnection as any).customParameters || new Map();

        const caller = params.From || "Unknown Caller";
        const callerName = customParams.get('callerName') || params.callerName || "";
        const callerCompany = customParams.get('callerCompany') || params.callerCompany || "";

        return (
            <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-4 fade-in duration-300">
                <div className="bg-white rounded-2xl shadow-2xl border-2 border-teal-500 overflow-hidden w-[350px]">
                    <div className="bg-teal-600 p-4 text-white flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-300 animate-pulse" />
                        <span className="font-bold tracking-widest text-xs uppercase">Incoming Transmission</span>
                    </div>

                    <div className="p-6 text-center space-y-2">
                        <h3 className="text-2xl font-black text-slate-800">{callerName || caller}</h3>
                        {callerCompany && <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{callerCompany}</p>}
                        {!callerName && !callerCompany && <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Inbound Call</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-px bg-slate-100 border-t border-slate-100">
                        <button
                            onClick={reject}
                            className="bg-white hover:bg-red-50 p-4 flex flex-col items-center gap-2 group transition-colors"
                        >
                            <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <PhoneOff className="h-5 w-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Decline</span>
                        </button>
                        <button
                            onClick={answer}
                            className="bg-white hover:bg-teal-50 p-4 flex flex-col items-center gap-2 group transition-colors"
                        >
                            <div className="h-10 w-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Phone className="h-5 w-5 animate-bounce" />
                            </div>
                            <span className="text-[10px] font-black uppercase text-teal-600 tracking-widest">Accept</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- ACTIVE CALL OVERLAY ---
    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (minimized) {
        return (
            <div className="fixed bottom-24 lg:bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300">
                <div className="bg-slate-900 rounded-full shadow-2xl border border-slate-700 p-2 flex items-center gap-3 pr-4">
                    <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                        <Phone className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest leading-tight">Active</span>
                        <span className="text-xs font-mono font-bold text-white">{formatDuration(activeCallDuration)}</span>
                    </div>
                    <button onClick={() => setMinimized(false)} className="ml-2 hover:bg-white/10 p-1.5 rounded-full text-slate-400 hover:text-white transition-colors">
                        <Maximize2 className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    // Full Active Overlay
    return (
        <div className="fixed bottom-24 lg:bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 w-[calc(100vw-2rem)] sm:w-[320px] overflow-hidden">
                {/* Header */}
                <div className="bg-slate-950 p-4 flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">On Air</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setMinimized(true)} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-colors">
                            <Minimize2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Call Info */}
                <div className="p-8 flex flex-col items-center justify-center space-y-4">
                    <div className="text-center">
                        <h3 className="text-2xl font-bold text-white tracking-tight">{outboundCallerId || activeConnection.parameters?.From || "Connected"}</h3>
                        <p className="text-xs font-mono text-slate-500 mt-1 uppercase tracking-widest">Voice Session Active</p>
                    </div>

                    <div className="text-4xl font-mono font-light text-white tracking-tighter">
                        {formatDuration(activeCallDuration)}
                    </div>
                </div>

                {/* Controls */}
                <div className="p-4 grid grid-cols-3 gap-2">
                    <button
                        onClick={toggleMute}
                        className={cn(
                            "h-14 rounded-2xl flex items-center justify-center transition-all",
                            isMuted ? "bg-white text-slate-900" : "bg-slate-800 text-white hover:bg-slate-700"
                        )}
                    >
                        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </button>

                    <button
                        onClick={() => setShowKeypad(!showKeypad)}
                        className={cn(
                            "h-14 rounded-2xl flex items-center justify-center transition-all",
                            showKeypad ? "bg-teal-600 text-white" : "bg-slate-800 text-white hover:bg-slate-700"
                        )}
                    >
                        <Grid3x3 className="h-6 w-6" />
                    </button>

                    <button
                        onClick={hangup}
                        className="h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all"
                    >
                        <PhoneOff className="h-6 w-6" />
                    </button>
                </div>

                {/* Keypad Drawer */}
                {showKeypad && (
                    <div className="p-4 bg-slate-950 border-t border-slate-900 grid grid-cols-3 gap-2">
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(digit => (
                            <button
                                key={digit}
                                onClick={() => sendDigit(digit)}
                                className="h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg transition-colors"
                            >
                                {digit}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
