"use client";

import { useTwilio } from "@/contexts/TwilioContext";
import { Phone, PhoneOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function GlobalCallOverlay() {
    const { incomingConnection, activeConnection, answer, reject } = useTwilio();
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (incomingConnection) {
            setIsVisible(true);
            // Play ringtone logic here if needed
        } else {
            setIsVisible(false);
        }
    }, [incomingConnection]);

    const handleAnswer = async () => {
        // 1. Redirect to Inbound page
        router.push("/inbound");

        // 2. Answer logic is handled in Context (including resumeAudio)
        answer();
    };

    if (!isVisible || !incomingConnection) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-md w-full mx-4 border border-zinc-200 relative overflow-hidden">

                {/* Background Pulse Effect */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500 animate-pulse-bar" />

                <div className="flex flex-col items-center text-center relative z-10">
                    <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6 animate-bounce-gentle">
                        <Phone className="h-8 w-8 text-emerald-600 fill-current animate-wiggle" />
                    </div>

                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight italic mb-2">
                        Incoming Transmission
                    </h2>
                    <p className="text-zinc-500 font-medium mb-8 font-mono bg-zinc-50 px-4 py-1 rounded-full border border-zinc-100">
                        {((incomingConnection as any).customParameters?.get('callerName')) ||
                            incomingConnection.parameters?.From ||
                            "Unknown Caller"}
                    </p>

                    <div className="flex items-center gap-4 w-full">
                        <button
                            onClick={reject}
                            className="flex-1 h-16 rounded-2xl border-2 border-red-100 text-red-600 font-bold uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2 group"
                        >
                            <PhoneOff className="h-5 w-5 stroke-[2.5] group-hover:scale-110 transition-transform" />
                            Decline
                        </button>
                        <button
                            onClick={handleAnswer}
                            className={cn(
                                "flex-1 h-16 rounded-2xl text-white font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 group shadow-lg",
                                activeConnection
                                    ? "bg-amber-500 hover:bg-amber-400 shadow-amber-500/30"
                                    : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30"
                            )}
                        >
                            <Phone className="h-5 w-5 fill-current group-hover:scale-110 transition-transform" />
                            {activeConnection ? "End & Answer" : "Answer"}
                        </button>
                    </div>

                    {activeConnection && (
                        <p className="text-[10px] font-bold text-amber-600 mt-4 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                            Warning: Current call will be terminated
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
