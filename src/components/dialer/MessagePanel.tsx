"use client";

import { MessageThread } from "@/components/messaging/MessageThread";
import { X, MessageSquare, RefreshCw } from "lucide-react";
import { useLead } from "@/contexts/LeadContext";
import { cn } from "@/lib/utils";

export function MessagePanel({ onClose, lastCalledNumber }: { onClose: () => void; lastCalledNumber?: string }) {
    const { currentLead } = useLead();

    return (
        <div className="absolute inset-y-0 right-0 w-96 bg-white border-l border-zinc-200 shadow-2xl flex flex-col z-50 transform transition-transform duration-300 animate-in slide-in-from-right">
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                    <h3 className="font-bold text-sm text-zinc-800 uppercase tracking-wide">SMS Relay</h3>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={onClose} className="p-1.5 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-red-500 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Thread Component */}
            <div className="flex-1 flex flex-col min-h-0">
                {currentLead ? (
                    <MessageThread
                        leadId={currentLead.id}
                        participantName={`${currentLead.firstName} ${currentLead.lastName}`.trim()}
                        lastCalledNumber={lastCalledNumber}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
                        No active lead selected
                    </div>
                )}
            </div>
        </div>
    );
}
