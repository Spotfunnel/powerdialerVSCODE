"use client";

import { useTwilio } from "@/contexts/TwilioContext";
import { cn } from "@/lib/utils";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { NotificationToggle } from "@/components/ui/NotificationToggle";

export function GlobalStatusWidget() {
    const { deviceState } = useTwilio();
    const [expanded, setExpanded] = useState(false);

    // if (deviceState === 'offline') return null;

    const isReady = deviceState === 'ready';
    const isError = deviceState === 'error';

    return (
        <div
            className="fixed top-5 left-5 sm:top-auto sm:left-3 sm:bottom-3 z-[9990] flex items-center gap-2 cursor-pointer group"
            onClick={() => setExpanded(!expanded)}
        >
            <div className={cn(
                "h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
                "opacity-40 sm:opacity-100 group-hover:opacity-100",
                isReady ? "bg-white text-green-600 border border-green-200" :
                    isError ? "bg-red-500 text-white" :
                        deviceState === 'offline' ? "bg-slate-900 text-slate-500 border border-slate-800" : "bg-slate-800 text-slate-400"
            )}>
                {isReady ? <Wifi className="h-3 w-3 sm:h-4 sm:w-4" /> : <WifiOff className="h-3 w-3 sm:h-4 sm:w-4" />}
            </div>

            {/* Notification Toggle - Only shows if permission is default/denied */}
            <NotificationToggle />

            <div className={cn(
                "bg-white border border-slate-200 shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2 transition-all duration-300 overflow-hidden",
                expanded || isError ? "max-w-[200px] opacity-100" : "max-w-0 opacity-0 p-0 border-0"
            )}>
                <div className="flex flex-col leading-none whitespace-nowrap">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Voice System</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn(
                            "text-xs font-bold",
                            isReady ? "text-green-600" : "text-red-500"
                        )}>
                            {deviceState.toUpperCase()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
