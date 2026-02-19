"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Building2, Phone, Briefcase, MessageSquare } from "lucide-react";

interface ContactCardProps {
    lead: any;
    onContactClick: (id: string) => void;
    onWizardClick: (lead: any) => void;
    onMessageClick: (id: string) => void;
}

export const ContactCard = memo(({ lead, onContactClick, onWizardClick, onMessageClick }: ContactCardProps) => {
    return (
        <div
            onClick={() => onContactClick(lead.id)}
            className="p-4 active:bg-zinc-50 transition-colors flex flex-col gap-3"
        >
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1 min-w-0">
                    <h3 className="text-sm font-bold text-zinc-900 truncate pr-2">{lead.companyName}</h3>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                        <Building2 className="h-3 w-3" />
                        {lead.industry || "General"}
                        <span className="h-1 w-1 rounded-full bg-zinc-200" />
                        {lead.suburb || lead.location}
                    </div>
                </div>
                <span className={cn(
                    "shrink-0 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border",
                    lead.status === 'READY' ? "bg-teal-50 text-teal-700 border-teal-100" : "bg-zinc-50 text-zinc-400 border-zinc-100",
                )}>
                    {lead.status}
                </span>
            </div>

            <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className={cn("h-1 w-2.5 rounded-full", i < lead.attempts ? "bg-teal-400" : "bg-zinc-100")} />
                            ))}
                        </div>
                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-tighter">
                            {lead.attempts} ATT
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onWizardClick(lead); }} className="h-9 w-9 flex items-center justify-center rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-500 active:scale-95"><Briefcase className="h-4 w-4" /></button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onMessageClick(lead.id);
                        }}
                        className="h-9 px-3 flex items-center justify-center gap-2 rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-500 font-black text-[10px] uppercase active:scale-95"
                    >
                        <MessageSquare className="h-4 w-4" />
                        SMS
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (lead.phoneNumber) onContactClick(lead.id);
                        }}
                        disabled={!lead.phoneNumber}
                        className={cn(
                            "h-9 px-4 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase shadow-lg active:scale-95 ml-1",
                            lead.phoneNumber ? "bg-teal-600 text-white" : "bg-zinc-100 text-zinc-300"
                        )}
                    >
                        <Phone className="h-3 w-3 fill-current" />
                        Dial
                    </button>
                </div>
            </div>
        </div>
    );
});

ContactCard.displayName = "ContactCard";
