"use client";

import { Calendar, Phone, Clock, Timer, Building2, Loader2, Trash2, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function CallbacksPage() {
    const router = useRouter();
    const [callbacks, setCallbacks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCallbacks = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/callbacks");
            if (res.ok) {
                const data = await res.json();
                setCallbacks(data);
            }
        } catch (err) {
            console.error("Failed to fetch callbacks", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCallbacks();
    }, []);

    const handleEngage = async (callbackId: string, leadId: string) => {
        try {
            // Mark as completed before navigating
            await fetch(`/api/callbacks`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: callbackId, status: 'COMPLETED' })
            });
            router.push(`/dialer?leadId=${leadId}`);
        } catch (err) {
            console.error("Failed to complete callback", err);
            // Still navigate as it's the primary intent
            router.push(`/dialer?leadId=${leadId}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this callback?")) return;
        try {
            const res = await fetch(`/api/callbacks?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchCallbacks();
        } catch (err) {
            console.error("Failed to delete callback", err);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-white overflow-hidden">
            {/* Header */}
            <header className="px-6 py-6 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-[1rem] bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-600/20">
                        <Clock className="h-6 w-6 text-white stroke-[2.5]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-black italic tracking-tight leading-none">Callback Queue</h1>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                            Active Prospect Retention
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchCallbacks}
                        className="p-2.5 text-zinc-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all"
                        title="Synchronize Queue"
                    >
                        <RotateCcw className={cn("h-5 w-5 stroke-[2.5]", loading && "animate-spin")} />
                    </button>
                    <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-zinc-50 border border-zinc-100 text-[11px] font-black text-teal-600 uppercase tracking-widest shadow-sm">
                        <Timer className="h-4 w-4 stroke-[3]" />
                        {callbacks.length} PENDING
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-12 w-12 text-teal-500 animate-spin" />
                    </div>
                ) : callbacks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 text-zinc-400 gap-4">
                        <Clock className="h-12 w-12 opacity-20" />
                        <p className="font-black uppercase tracking-widest text-xs italic">Clear Horizons: No pending follow-ups</p>
                    </div>
                ) : (
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-100 z-10">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Scheduled Threshold</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Contact Identity</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Strategic Context</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">Protocol Execution</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {callbacks.map((cb) => (
                                <tr key={cb.id} className="group hover:bg-zinc-50 transition-colors">
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-teal-600 text-xs font-black italic">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {new Date(cb.callbackAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="text-[10px] font-bold text-zinc-400 uppercase">
                                                {new Date(cb.callbackAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6" onClick={() => handleEngage(cb.id, cb.leadId)}>
                                        <div className="flex flex-col cursor-pointer hover:underline decoration-teal-500/30">
                                            <span className="text-sm font-black text-zinc-900 tracking-tight italic">
                                                {cb.lead.firstName} {cb.lead.lastName}
                                            </span>
                                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                                                <Building2 className="h-3 w-3" />
                                                {cb.lead.companyName}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 max-w-md">
                                        <p className="text-[11px] font-bold text-zinc-500 leading-relaxed italic">
                                            "{cb.notes || "Establish connection sequence; no prior intelligence."}"
                                        </p>
                                    </td>
                                    <td className="px-6 py-6 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <button
                                                onClick={() => handleDelete(cb.id)}
                                                className="p-2.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Abort Retention"
                                            >
                                                <Trash2 className="h-4 w-4 stroke-[2.5]" />
                                            </button>
                                            <button
                                                onClick={() => handleEngage(cb.id, cb.leadId)}
                                                className="px-5 py-2.5 bg-zinc-900 border-2 border-zinc-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2"
                                            >
                                                <Phone className="h-3.5 w-3.5 fill-current" />
                                                Connect Now
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
