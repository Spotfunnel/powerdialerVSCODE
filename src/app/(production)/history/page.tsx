"use client";

import { useEffect, useState } from "react";
import { Loader2, Phone, Clock, FileAudio, User, Building2, Calendar, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallLog {
    id: string;
    createdAt: string;
    direction: string;
    duration: number;
    outcome: string | null;
    recordingUrl: string | null;
    status: string;
    lead: {
        firstName: string | null;
        lastName: string | null;
        companyName: string;
        phoneNumber: string;
    };
    user: {
        name: string | null;
        email: string;
    };
}

export default function HistoryPage() {
    const [logs, setLogs] = useState<CallLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchLogs = async (newPage: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/voice/history?page=${newPage}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs);
                setTotalPages(data.totalPages);
                setPage(data.currentPage);
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs(1);
    }, []);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full h-full flex flex-col bg-white overflow-hidden">
            <header className="px-4 sm:px-6 py-4 sm:py-6 border-b border-zinc-100 flex flex-wrap items-center justify-between bg-white shrink-0 gap-3">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-[1rem] bg-zinc-900 flex items-center justify-center shadow-lg shadow-zinc-900/20">
                        <Phone className="h-6 w-6 text-white stroke-[2.5]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-black italic tracking-tight leading-none">Global Voice Logs</h1>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            System Audit Trail
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        disabled={page <= 1}
                        onClick={() => fetchLogs(page - 1)}
                        className="p-2.5 rounded-xl border border-zinc-200 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-50 hover:text-zinc-600 transition-all"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Page {page} of {totalPages}</span>
                    <button
                        disabled={page >= totalPages}
                        onClick={() => fetchLogs(page + 1)}
                        className="p-2.5 rounded-xl border border-zinc-200 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-50 hover:text-zinc-600 transition-all"
                    >
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto custom-scrollbar -webkit-overflow-scrolling-touch">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-12 w-12 text-teal-500 animate-spin" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 text-zinc-300 gap-4">
                        <FileAudio className="h-12 w-12 opacity-20" />
                        <p className="font-black uppercase tracking-widest text-xs italic">No voice data recorded</p>
                    </div>
                ) : (
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-100 z-10">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Timestamp</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Target Asset</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Outcome / Duration</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Agent</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">Evidence</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {logs.map((log) => (
                                <tr key={log.id} className="group hover:bg-zinc-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-zinc-600 text-xs font-bold">
                                                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                                                {new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="text-[10px] font-black text-zinc-300 uppercase pl-5.5">
                                                {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-zinc-900 italic tracking-tight">
                                                {(log.lead?.firstName || log.lead?.lastName)
                                                    ? `${log.lead.firstName || ''} ${log.lead.lastName || ''}`.trim()
                                                    : (log.lead?.phoneNumber || 'Unknown Caller')}
                                            </span>
                                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                                                <Building2 className="h-3 w-3" />
                                                {log.lead?.companyName || 'Unknown Company'}
                                                {log.lead?.phoneNumber && <span className="text-zinc-300 ml-1">• {log.lead.phoneNumber}</span>}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className={cn(
                                                "text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded w-fit",
                                                log.status === "completed" ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                                            )}>
                                                {log.outcome || log.status}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase pl-0.5">
                                                <Clock className="h-3 w-3" />
                                                {formatDuration(log.duration)}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center">
                                                <User className="h-3 w-3 text-zinc-400" />
                                            </div>
                                            <span className="text-xs font-bold text-zinc-600">{log.user.name || "System"}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {log.recordingUrl ? (
                                            <audio controls className="h-8 max-w-[200px] ml-auto">
                                                <source src={log.recordingUrl} type="audio/mpeg" />
                                            </audio>
                                        ) : (
                                            <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest italic">No Audio</span>
                                        )}
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
