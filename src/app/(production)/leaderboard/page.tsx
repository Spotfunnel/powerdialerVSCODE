"use client";

import { Trophy, PhoneCall, CalendarCheck, DollarSign, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { LeadProvider } from "@/contexts/LeadContext";

// Mock data fetching until we hook up the backend aggregation
// This component should naturally fetch this data
function LeaderboardContent() {
    const [reps, setReps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/leaderboard')
            .then(res => res.json())
            .then(data => {
                setReps(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch leaderboard", err);
                setLoading(false);
            });
    }, []);

    // Sort by rank or performance if metrics were > 0
    const sortedReps = [...reps].sort((a, b) => a.rank - b.rank);

    if (loading) {
        return (
            <div className="min-h-full flex items-center justify-center bg-zinc-50/50">
                <Loader2 className="h-12 w-12 text-teal-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-full p-4 lg:p-8 flex items-center justify-center bg-zinc-50/50">
            {/* Main Card */}
            <div className="w-full max-w-6xl aspect-video bg-white border border-zinc-200 shadow-2xl rounded-[3rem] overflow-hidden relative flex flex-col items-center justify-center">

                {/* Background Decor - "Trophy Style" */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                    <Trophy className="w-[600px] h-[600px] text-teal-900" />
                </div>

                {/* Header */}
                <div className="absolute top-12 text-center z-10">
                    <h1 className="text-4xl font-black text-black tracking-tighter italic">LIVE CLASH</h1>
                    <p className="text-xs font-bold uppercase tracking-[0.4em] text-zinc-400 mt-2">Leo vs Kye</p>
                </div>

                {/* The Ring */}
                <div className="flex w-full items-end justify-center gap-20 px-12 pb-12 z-10 mt-12">
                    {/* 2nd Place (Left) - Usually Kye if ranked 2nd */}
                    {sortedReps[1] && (
                        <div className="flex flex-col items-center transform transition-transform hover:scale-105 duration-300">
                            <div className="relative group mb-6">
                                <div className="h-28 w-28 rounded-full border-4 border-zinc-200 bg-white shadow-xl flex items-center justify-center text-3xl font-black text-zinc-300">
                                    {sortedReps[1].name[0]}
                                </div>
                                <div className="absolute -top-3 -right-3 bg-zinc-700 text-white h-8 w-8 rounded-full flex items-center justify-center font-bold shadow-lg text-sm">#2</div>
                            </div>

                            <h2 className="text-3xl font-black text-zinc-400 italic mb-6">{sortedReps[1].name}</h2>

                            <div className="flex gap-6 opacity-80 bg-zinc-50 px-6 py-3 rounded-2xl border border-zinc-100 shadow-sm">
                                <div className="text-center">
                                    <div className="text-xl font-black font-mono text-zinc-700">{sortedReps[1].calls}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 mt-1">Calls</div>
                                </div>
                                <div className="w-px h-8 bg-zinc-200"></div>
                                <div className="text-center">
                                    <div className="text-xl font-black font-mono text-teal-600">{sortedReps[1].bookings}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-teal-600/70 mt-1">Books</div>
                                </div>
                                <div className="w-px h-8 bg-zinc-200"></div>
                                <div className="text-center">
                                    <div className="text-xl font-black font-mono text-emerald-600">{sortedReps[1].sales}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-600/70 mt-1">Sales</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VS Badge */}
                    <div className="pb-32 opacity-10 font-black text-7xl italic text-zinc-400 select-none">VS</div>

                    {/* 1st Place (Right/Center) - The Winner */}
                    {sortedReps[0] && (
                        <div className="flex flex-col items-center scale-110 origin-bottom transform transition-transform hover:scale-115 duration-300">
                            <div className="relative group mb-8">
                                <div className="h-40 w-40 rounded-full border-[6px] border-teal-500 bg-white shadow-2xl shadow-teal-500/20 flex items-center justify-center text-5xl font-black text-black">
                                    <Trophy className="h-14 w-14 text-yellow-400 fill-yellow-400 stroke-yellow-600 absolute -top-8 drop-shadow-md" />
                                    {sortedReps[0].name[0]}
                                </div>
                                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-teal-600 text-white px-3 py-1 rounded-full font-black text-xs uppercase tracking-widest shadow-lg whitespace-nowrap">
                                    Champion
                                </div>
                            </div>

                            <h2 className="text-5xl font-black text-black italic mb-6 drop-shadow-sm">{sortedReps[0].name}</h2>

                            <div className="flex gap-8 bg-white border border-zinc-100 px-8 py-5 rounded-2xl shadow-xl shadow-zinc-200/50">
                                <div className="text-center">
                                    <div className="text-3xl font-black font-mono text-zinc-800">{sortedReps[0].calls}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-1 flex items-center justify-center gap-1">
                                        <PhoneCall className="h-3 w-3" /> Calls
                                    </div>
                                </div>
                                <div className="w-px h-10 bg-zinc-200"></div>
                                <div className="text-center">
                                    <div className="text-3xl font-black font-mono text-teal-600">{sortedReps[0].bookings}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-teal-600 mt-1 flex items-center justify-center gap-1">
                                        <CalendarCheck className="h-3 w-3" /> Books
                                    </div>
                                </div>
                                <div className="w-px h-10 bg-zinc-200"></div>
                                <div className="text-center">
                                    <div className="text-3xl font-black font-mono text-emerald-600">{sortedReps[0].sales}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mt-1 flex items-center justify-center gap-1">
                                        <DollarSign className="h-3 w-3" /> Sales
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

import { Suspense } from "react";

export default function LeaderboardPage() {
    return (
        <Suspense fallback={
            <div className="min-h-full flex items-center justify-center bg-zinc-50/50">
                <Loader2 className="h-12 w-12 text-teal-600 animate-spin" />
            </div>
        }>
            <LeadProvider>
                <LeaderboardContent />
            </LeadProvider>
        </Suspense>
    );
}
