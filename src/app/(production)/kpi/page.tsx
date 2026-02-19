"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, Calendar, Phone, CheckCircle, DollarSign, ArrowUpRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPIData {
    calls: number;
    booked: number;
    sold: number;
}

interface UserKPI {
    id: string;
    name: string;
    stats: {
        daily: KPIData;
        weekly: KPIData;
        monthly: KPIData;
    };
}

interface KPIResponse {
    period: string;
    users: UserKPI[];
    history: { label: string, value: string }[];
}

export default function KPIPage() {
    const [data, setData] = useState<KPIResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>(""); // Empty = Current

    const fetchData = async (month?: string) => {
        setLoading(true);
        try {
            const query = month ? `?month=${month}` : "";
            const res = await fetch(`/api/kpi${query}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (e) {
            console.error("Failed to fetch KPIs", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(selectedMonth);
    }, [selectedMonth]);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 text-teal-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight italic">
                        Performance <span className="text-teal-600">Headquarters</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Live metrics for High-Performance Specialist Team.
                    </p>
                </div>

                {/* Month Selector */}
                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <Calendar className="h-4 w-4 text-slate-400 ml-2" />
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-700 outline-none p-2 cursor-pointer"
                    >
                        {data?.history.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {data?.users.map((user) => (
                    <div key={user.id} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* User Header */}
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white font-black text-xl">
                                {user.name.charAt(0)}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide">{user.name}</h2>
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Active Specialist</span>
                                </div>
                            </div>
                        </div>

                        {/* DAILY PULSE */}
                        <div className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-32 bg-teal-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                            <div className="flex items-center justify-between mb-8 relative z-10">
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-teal-400" />
                                    Daily Pulse
                                </h3>
                                <span className="text-xs font-mono text-slate-500 border border-slate-700 px-2 py-1 rounded">TODAY</span>
                            </div>

                            <div className="grid grid-cols-3 gap-8 relative z-10">
                                <StatItem
                                    label="Calls"
                                    value={user.stats.daily.calls}
                                    icon={Phone}
                                    color="text-blue-400"
                                    detail="made today"
                                />
                                <StatItem
                                    label="Booked"
                                    value={user.stats.daily.booked}
                                    icon={CheckCircle}
                                    color="text-emerald-400"
                                    detail="demos set"
                                    highlight
                                />
                                <StatItem
                                    label="Sold"
                                    value={user.stats.daily.sold}
                                    icon={DollarSign}
                                    color="text-amber-400"
                                    detail="closed deals"
                                />
                            </div>
                        </div>

                        {/* WEEKLY & MONTHLY GRID */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Weekly Card */}
                            <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-6">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Weekly Performance</h4>
                                </div>
                                <div className="space-y-6">
                                    <RowStat label="Calls" value={user.stats.weekly.calls} total={200} />
                                    <RowStat label="Bookings" value={user.stats.weekly.booked} total={10} color="emerald" />
                                    <RatioStat
                                        label="Call to Book"
                                        value={user.stats.weekly.booked > 0 ? ((user.stats.weekly.booked / user.stats.weekly.calls) * 100).toFixed(1) : "0"}
                                        suffix="%"
                                    />
                                </div>
                            </div>

                            {/* Monthly Card */}
                            <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 p-6 rounded-[2rem] shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{data?.period}</h4>
                                    <Trophy className="h-4 w-4 text-amber-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                        <span className="block text-2xl font-black text-slate-900">{user.stats.monthly.booked}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Booked</span>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                        <span className="block text-2xl font-black text-emerald-600">{user.stats.monthly.sold}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sold</span>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-100">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Close Rate</span>
                                        <span className="text-lg font-black text-slate-900">
                                            {user.stats.monthly.booked > 0
                                                ? ((user.stats.monthly.sold / user.stats.monthly.booked) * 100).toFixed(0)
                                                : "0"}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                        <div
                                            className="h-full bg-slate-900 rounded-full"
                                            style={{ width: `${Math.min(user.stats.monthly.booked > 0 ? (user.stats.monthly.sold / user.stats.monthly.booked) * 100 : 0, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
}

function StatItem({ label, value, icon: Icon, color, detail, highlight }: any) {
    return (
        <div className="flex flex-col gap-1">
            <span className={cn("text-xs font-bold uppercase tracking-widest flex items-center gap-2", color)}>
                <Icon className="h-3 w-3" /> {label}
            </span>
            <span className={cn("text-4xl font-black tracking-tighter", highlight ? "text-white scale-110 origin-left" : "text-slate-200")}>
                {value}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase">{detail}</span>
        </div>
    );
}

function RowStat({ label, value, total, color = "blue" }: any) {
    const percentage = Math.min((value / total) * 100, 100);
    const colorClass = color === "emerald" ? "bg-emerald-500" : "bg-blue-500";

    return (
        <div>
            <div className="flex justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-600 uppercase">{label}</span>
                <span className="text-xs font-black text-slate-900">{value} <span className="text-slate-300">/ {total}</span></span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-1000", colorClass)} style={{ width: `${percentage}%` }} />
            </div>
        </div>
    );
}

function RatioStat({ label, value, suffix }: any) {
    return (
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-xs font-bold text-slate-500 uppercase">{label}</span>
            <div className="flex items-center gap-1">
                <span className="text-lg font-black text-slate-900">{value}{suffix}</span>
                <ArrowUpRight className="h-4 w-4 text-teal-500" />
            </div>
        </div>
    );
}
