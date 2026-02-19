"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Building2, Phone, Briefcase, MessageSquare } from "lucide-react";

interface ContactRowProps {
    lead: any;
    columns: any[];
    onContactClick: (id: string) => void;
    onWizardClick: (lead: any) => void;
    onMessageClick: (id: string) => void;
}

export const ContactRow = memo(({ lead, columns, onContactClick, onWizardClick, onMessageClick }: ContactRowProps) => {
    return (
        <tr
            onClick={() => onContactClick(lead.id)}
            className="group hover:bg-teal-50/30 transition-colors cursor-pointer focus:outline-none focus:bg-teal-50"
        >
            {columns.filter(c => c.visible).map(col => {
                switch (col.id) {
                    case 'companyName':
                        return (
                            <td key={col.id} className="px-4 py-4">
                                <div className="flex flex-col max-w-[200px]">
                                    <span className="text-sm font-bold text-zinc-900 leading-tight truncate" title={lead.companyName}>
                                        {lead.companyName}
                                    </span>
                                    <span className="text-[10px] font-medium text-zinc-400 truncate" title={`${lead.firstName} ${lead.lastName}`}>
                                        {lead.firstName} {lead.lastName}
                                    </span>
                                </div>
                            </td>
                        );
                    case 'location':
                        return (
                            <td key={col.id} className="px-4 py-4">
                                <div className="text-[10px] font-bold text-zinc-500 uppercase">
                                    {lead.suburb || lead.location}
                                    {lead.state && <span className="text-zinc-400 ml-1">{lead.state}</span>}
                                </div>
                            </td>
                        );
                    case 'status':
                        return (
                            <td key={col.id} className="px-4 py-4">
                                <span className={cn(
                                    "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border",
                                    lead.status === 'READY' ? "bg-teal-50 text-teal-700 border-teal-100" : "bg-zinc-50 text-zinc-400 border-zinc-100",
                                    lead.status === 'ARCHIVED' && "bg-zinc-100 text-zinc-500",
                                    lead.status === 'DQ' && "bg-red-50 text-red-600 border-red-100"
                                )}>
                                    {lead.status}
                                </span>
                            </td>
                        );
                    case 'industry':
                        return (
                            <td key={col.id} className="px-4 py-4">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase">
                                    <Building2 className="h-3 w-3" />
                                    {lead.industry || "General"}
                                </div>
                            </td>
                        );
                    case 'activity':
                        return (
                            <td key={col.id} className="px-4 py-4">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-0.5">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "h-1 w-3 rounded-full",
                                                    i < lead.attempts ? "bg-teal-400" : "bg-zinc-100"
                                                )}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-tighter">
                                        {lead.attempts} ATT
                                    </span>
                                </div>
                            </td>
                        );
                    case 'email':
                        return (
                            <td key={col.id} className="px-4 py-4 text-[10px] text-zinc-500 font-medium">
                                {lead.email}
                            </td>
                        );
                    case 'phone':
                        return (
                            <td key={col.id} className="px-4 py-4 text-[10px] text-zinc-500 font-mono">
                                {lead.phoneNumber}
                            </td>
                        );
                    case 'employees':
                        return (
                            <td key={col.id} className="px-4 py-4 text-[10px] text-zinc-500">
                                {lead.employees}
                            </td>
                        );
                    case 'actions':
                        return (
                            <td key={col.id} className="px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onWizardClick(lead);
                                        }}
                                        className="h-8 px-3 bg-white border border-zinc-200 rounded-lg text-[9px] font-bold uppercase text-zinc-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                                    >
                                        <Briefcase className="h-3 w-3" />
                                        Pipeline
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMessageClick(lead.id);
                                        }}
                                        className="h-8 px-3 bg-white border border-zinc-200 rounded-lg text-[9px] font-bold uppercase text-zinc-600 hover:text-teal-600 hover:border-teal-200 hover:bg-teal-50 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                                        title="Send SMS"
                                    >
                                        <MessageSquare className="h-3 w-3" />
                                        Message
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (lead.phoneNumber) onContactClick(lead.id);
                                        }}
                                        disabled={!lead.phoneNumber}
                                        className={cn(
                                            "h-8 px-3 rounded-lg text-[9px] font-black uppercase transition-all shadow-md flex items-center gap-2 active:scale-95",
                                            lead.phoneNumber ? "bg-zinc-900 hover:bg-black text-white" : "bg-zinc-100 text-zinc-400 cursor-not-allowed shadow-none"
                                        )}
                                    >
                                        <Phone className="h-3 w-3 fill-current" />
                                        Dial
                                    </button>
                                </div>
                            </td>
                        );
                    default:
                        return <td key={col.id}></td>;
                }
            })}
        </tr>
    );
});

ContactRow.displayName = "ContactRow";
