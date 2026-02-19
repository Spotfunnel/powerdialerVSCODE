"use client";

import { Play, Phone, Archive, Trash2, Mic2, Clock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";


export default function InboundPage() {
    const router = useRouter();
    const [inboundItems, setInboundItems] = useState<any[]>([]);

    const handleCallback = (lead: any) => {
        // If we had real leads, we'd pass the actual ID. For mocks, we just go to dialer.
        router.push(`/dialer?leadId=${lead.id}`);
    };

    const handleDelete = (id: number) => {
        if (!confirm("Remove this log?")) return;
        setInboundItems(prev => prev.filter(item => item.id !== id));
    };

    return (
        <div className="w-full h-full flex flex-col bg-white overflow-hidden">
            {/* Standard Unified Action Card - using full width */}
            <div className="w-full bg-white flex flex-col h-full">

                {/* Header - High Resolution Iconography */}
                <header className="px-5 py-6 sm:px-10 sm:py-10 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between bg-white shrink-0 gap-4">
                    <div className="flex items-center gap-4 sm:gap-6">
                        <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-xl sm:rounded-[1.25rem] bg-teal-600 flex items-center justify-center shadow-xl shadow-teal-600/20 shrink-0">
                            <Mic2 className="h-6 w-6 sm:h-9 sm:w-9 text-white stroke-[2.5]" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight italic">Inbound</h1>
                            <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-zinc-400 mt-1">Monitor incoming transmissions</p>
                        </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-zinc-50 border border-zinc-100 text-[11px] font-black text-teal-600 uppercase tracking-widest shadow-sm self-start sm:self-auto">
                        <Globe className="h-4 w-4 stroke-[3]" />
                        Gateway: Active
                    </div>
                </header>

                <div className="flex-1 overflow-auto custom-scrollbar p-4 sm:p-10">
                    <div className="space-y-4">
                        {inboundItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-10 sm:p-20 text-center opacity-50">
                                <div className="h-12 w-12 sm:h-16 sm:w-16 mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                    <Archive className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-700">No Inbound Messages</h3>
                                <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-sm">
                                    Voicemails, recordings, and missed call alerts will appear here.
                                </p>
                            </div>
                        ) : inboundItems.map((msg) => (
                            <div key={msg.id} className="group relative bg-white border border-zinc-100 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 transition-all duration-300 hover:bg-zinc-50 hover:border-zinc-200 hover:shadow-lg">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6">
                                    <div className="flex items-start sm:items-center gap-4 sm:gap-6">
                                        <button className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center hover:bg-teal-600 hover:text-white transition-all shadow-md group/play active:scale-90 shrink-0">
                                            <Play className="h-5 w-5 sm:h-7 sm:w-7 fill-current ml-1 transition-transform group-hover/play:scale-110" />
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                                                <h3 className="font-black text-black italic text-lg sm:text-2xl leading-none truncate">{msg.from}</h3>
                                                {msg.status === 'unheard' && (
                                                    <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse shrink-0" />
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                                                <div className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-1.5">
                                                    <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[2.5]" />
                                                    {msg.date}
                                                </div>
                                                <div className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-teal-600/80 flex items-center gap-1.5">
                                                    <Mic2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[2.5]" />
                                                    {msg.duration} TRANS
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-zinc-50">
                                        <span className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-zinc-50 border border-zinc-100 text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:bg-white transition-all shadow-sm">
                                            {msg.type}
                                        </span>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleCallback(msg)}
                                                className="px-4 py-2.5 sm:px-5 sm:py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-md active:scale-95"
                                            >
                                                <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[3]" />
                                                <span className="hidden xs:inline">Callback</span>
                                            </button>

                                            <div className="flex items-center gap-1 sm:gap-2 sm:ml-2 sm:border-l border-zinc-200 sm:pl-4">
                                                <button
                                                    onClick={() => handleDelete(msg.id)}
                                                    className="p-2.5 sm:p-3 text-zinc-300 hover:text-red-500 hover:bg-white rounded-xl transition-all shadow-sm active:scale-90"
                                                >
                                                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
