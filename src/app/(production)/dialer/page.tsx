"use client";

import { useState, useEffect } from "react";
import { LeadProvider } from "@/contexts/LeadContext";
import { CallInterface } from "@/components/dialer/CallInterface";
import { DispositionPanel } from "@/components/dialer/DispositionPanel";
import { MessagePanel } from "@/components/dialer/MessagePanel";
import { useSearchParams } from "next/navigation";

import { Suspense } from "react";

export default function DialerPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Systems...</p>
                </div>
            </div>
        }>
            <LeadProvider>
                <DialerContent />
            </LeadProvider>
        </Suspense>
    );
}

function DialerContent() {
    const searchParams = useSearchParams();
    const [showMessages, setShowMessages] = useState(false);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'messaging') {
            setShowMessages(true);
        }
    }, [searchParams]);

    return (
        <div className="min-h-full flex flex-col items-center justify-center p-0 sm:p-4 lg:p-6 overflow-hidden">
            {/* Unified Extreme Action Card - Max width for horizontal flow */}
            <div className="w-full max-w-6xl bg-white border-x sm:border border-zinc-200 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] sm:rounded-[3rem] overflow-hidden flex flex-col h-full sm:max-h-[95vh] relative">

                {/* Extremely Compact Header & Dial Controls */}
                <div className="px-3 sm:px-6 md:px-10 py-3 sm:py-6 border-b border-zinc-50 shrink-0">
                    <CallInterface
                        onToggleMessages={() => setShowMessages(!showMessages)}
                        showMessages={showMessages}
                    />
                </div>

                {/* Dominant Data Capture Plane - Zero Scroll Focus */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 md:p-10 bg-white relative">
                    <DispositionPanel />
                </div>

                {showMessages && <MessagePanel onClose={() => setShowMessages(false)} />}
            </div>
        </div>
    );
}
