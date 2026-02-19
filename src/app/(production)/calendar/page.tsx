"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Plus, User, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { generateAESTSlots, calculateAvailability, TimeSlot } from "@/lib/calendar-logic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CalendarContent() {
    const { data: session } = useSession();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [availability, setAvailability] = useState<{ [key: string]: TimeSlot[] }>({});
    const [loading, setLoading] = useState(true);
    const [selectedSpecialist, setSelectedSpecialist] = useState<"Leo" | "Kye" | null>(null);

    // Initial detect from session
    useEffect(() => {
        if (session?.user?.name && !selectedSpecialist) {
            const name = session.user.name;
            const detect = name.includes("Leo") ? "Leo" : name.includes("Kye") ? "Kye" : "Leo";
            setSelectedSpecialist(detect as "Leo" | "Kye");
        }
    }, [session, selectedSpecialist]);

    const activeSpecialist = selectedSpecialist || "Leo";

    const searchParams = useSearchParams();
    const leadId = searchParams.get("leadId");

    // Load lead info if leadId is present
    useEffect(() => {
        if (leadId) {
            fetch(`/api/crm/contacts/${leadId}`)
                .then(res => res.json())
                .then(lead => {
                    if (lead && !lead.error) {
                        setBookingFormData({
                            name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.companyName || '',
                            email: lead.email || '',
                            phone: lead.phoneNumber || '',
                            notes: lead.companyName ? `Meeting for ${lead.companyName}` : ''
                        });
                    }
                })
                .catch(err => console.error("Failed to pre-fill lead", err));
        }
    }, [leadId]);

    // 7 Days Range
    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentDate);
        d.setDate(currentDate.getDate() + i);
        return d;
    });

    useEffect(() => {
        const fetchAvailability = async () => {
            setLoading(true);
            const start = weekDates[0];
            const end = new Date(weekDates[6]);
            end.setHours(23, 59, 59);

            try {
                const res = await fetch(`/api/calendar/availability?startDate=${start.toISOString()}&endDate=${end.toISOString()}`);
                const data = await res.json();

                if (data.events) {
                    const newAvailability: { [key: string]: TimeSlot[] } = {};

                    weekDates.forEach(date => {
                        const dateKey = date.toISOString().split('T')[0];
                        const baseSlots = generateAESTSlots(date);
                        const dailySlots = calculateAvailability(baseSlots, data.events, activeSpecialist);
                        newAvailability[dateKey] = dailySlots;
                    });

                    setAvailability(newAvailability);
                }
            } catch (error) {
                console.error("Failed to load availability", error);
            } finally {
                setLoading(false);
            }
        };

        if (session) {
            fetchAvailability();
        }
    }, [currentDate, session, activeSpecialist]);

    const handleNextWeek = () => {
        const next = new Date(currentDate);
        next.setDate(currentDate.getDate() + 7);
        setCurrentDate(next);
    };

    const handlePrevWeek = () => {
        const prev = new Date(currentDate);
        prev.setDate(currentDate.getDate() - 7);
        // Don't go back past today
        if (prev >= new Date(new Date().setHours(0, 0, 0, 0))) {
            setCurrentDate(prev);
        }
    };

    const [bookingModalOpen, setBookingModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ date: string, slot: TimeSlot } | null>(null);
    const [bookingFormData, setBookingFormData] = useState({ name: '', email: '', phone: '', notes: '' });
    const [bookingSubmitting, setBookingSubmitting] = useState(false);

    const handleSlotClick = (dateKey: string, slot: TimeSlot) => {
        setSelectedSlot({ date: dateKey, slot });
        setBookingModalOpen(true);
    };

    const handleBookingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSlot) return;
        setBookingSubmitting(true);

        try {
            const payload = {
                specialist: activeSpecialist,
                start: selectedSlot.slot.start.toISOString(),
                end: selectedSlot.slot.end.toISOString(),
                leadId: leadId || undefined,
                ...bookingFormData
            };

            const res = await fetch('/api/calendar/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("Booking Confirmed!"); // To be replaced with Toast later
                setBookingModalOpen(false);
                setBookingFormData({ name: '', email: '', phone: '', notes: '' });
                // Refresh availability
                window.location.reload();
            } else {
                alert("Booking Failed: " + await res.text());
            }
        } catch (err) {
            console.error(err);
            alert("Network Error");
        } finally {
            setBookingSubmitting(false);
        }
    };

    return (
        <div className="min-h-full p-4 lg:p-8 flex items-center justify-center relative">
            <div className="w-full max-w-7xl bg-white border border-zinc-200 shadow-xl rounded-[2rem] overflow-hidden flex flex-col h-[85vh]">
                {/* ... (Header remains same) */}
                <header className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-teal-600 flex items-center justify-center">
                            <CalIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-black tracking-tight">Calendar</h1>
                            <p className="text-xs font-medium text-zinc-500">7-Day Rolling View • AEST Timezone</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Specialist Switcher */}
                        <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200 shadow-inner">
                            <button
                                onClick={() => setSelectedSpecialist("Leo")}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeSpecialist === "Leo"
                                    ? "bg-white text-teal-600 shadow-sm border border-zinc-200"
                                    : "text-zinc-400 hover:text-zinc-600"
                                    }`}
                            >
                                Leo
                            </button>
                            <button
                                onClick={() => setSelectedSpecialist("Kye")}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeSpecialist === "Kye"
                                    ? "bg-white text-teal-600 shadow-sm border border-zinc-200"
                                    : "text-zinc-400 hover:text-zinc-600"
                                    }`}
                            >
                                Kye
                            </button>
                        </div>

                        <div className="flex bg-zinc-50 border border-zinc-200 rounded-xl p-1 shadow-sm">
                            <button onClick={handlePrevWeek} className="p-1.5 hover:bg-white hover:text-teal-600 rounded-lg transition-all text-zinc-400">
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <span className="px-6 py-1.5 text-sm font-bold text-black italic w-40 text-center">
                                {currentDate.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                            </span>
                            <button onClick={handleNextWeek} className="p-1.5 hover:bg-white hover:text-teal-600 rounded-lg transition-all text-zinc-400">
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Header Row */}
                    <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
                        {weekDates.map(date => (
                            <div key={date.toString()} className="py-4 text-center border-r border-zinc-200 last:border-0">
                                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                </div>
                                <div className={`text-lg font-bold mt-1 ${date.toDateString() === new Date().toDateString() ? 'text-teal-600' : 'text-black'
                                    }`}>
                                    {date.getDate()}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Slots Grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-7 min-h-full">
                                {weekDates.map((date, colIndex) => {
                                    const dateKey = date.toISOString().split('T')[0];
                                    const daySlots = availability[dateKey] || [];

                                    return (
                                        <div key={dateKey} className="border-r border-zinc-200 last:border-0 py-2">
                                            {daySlots.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-zinc-400 italic">No slots</div>
                                            ) : (
                                                <div className="flex flex-col gap-2 px-2">
                                                    {daySlots.map((slot, slotIndex) => {
                                                        const timeLabel = slot.start.toLocaleTimeString('en-AU', {
                                                            hour: 'numeric',
                                                            minute: '2-digit',
                                                            hour12: true
                                                        });

                                                        const isMeeting = slot.isBookedByCurrentUser && slot.events && slot.events.length > 0;

                                                        if (isMeeting) {
                                                            const event = slot.events![0];
                                                            return (
                                                                <div
                                                                    key={`${dateKey}-${slotIndex}`}
                                                                    className="bg-teal-600 border border-teal-500 rounded-xl p-3 shadow-lg shadow-teal-500/20 animate-in zoom-in-95 duration-300"
                                                                >
                                                                    <div className="text-[9px] font-black text-teal-200 uppercase tracking-widest flex justify-between items-center mb-1">
                                                                        <span>{timeLabel}</span>
                                                                        <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                                                    </div>
                                                                    <div className="text-[11px] font-black text-white leading-tight uppercase tracking-tight truncate">
                                                                        {event.summary || "Secured Protocol"}
                                                                    </div>
                                                                    <div className="mt-1 text-[8px] font-bold text-teal-100 uppercase opacity-60">
                                                                        Confirmed Meeting
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        const isTakenByOther = slot.remainingSeats === 0;

                                                        return (
                                                            <button
                                                                key={`${dateKey}-${slotIndex}`}
                                                                disabled={isTakenByOther}
                                                                onClick={() => !isTakenByOther && handleSlotClick(dateKey, slot)}
                                                                className={`
                                                                     flex flex-col items-center justify-center py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all
                                                                     ${isTakenByOther
                                                                        ? "bg-zinc-100 border-zinc-100 text-zinc-300 cursor-not-allowed opacity-40"
                                                                        : "bg-white border-zinc-100 text-zinc-400 hover:border-teal-200 hover:text-teal-600 hover:bg-teal-50/30 cursor-pointer shadow-sm hover:translate-y-[-1px]"
                                                                    }
                                                                 `}
                                                            >
                                                                <span className="font-mono text-[11px]">{timeLabel}</span>
                                                                <span className="text-[7px] font-black opacity-60 mt-0.5">
                                                                    {isTakenByOther ? "UNAESTHETIC" : "AVAILABLE"}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Booking Modal */}
            {bookingModalOpen && selectedSlot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="mb-6">
                            <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Confirm Booking</h2>
                            <p className="text-zinc-500 text-sm mt-1">
                                with <span className="text-teal-600 font-bold">{activeSpecialist}</span> on {new Date(selectedSlot.date).toLocaleDateString('en-AU', { weekday: 'long', month: 'short', day: 'numeric' })} at {selectedSlot.slot.start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                            </p>
                        </div>

                        <form onSubmit={handleBookingSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Name</label>
                                <input
                                    required
                                    value={bookingFormData.name}
                                    onChange={e => setBookingFormData({ ...bookingFormData, name: e.target.value })}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={bookingFormData.email}
                                    onChange={e => setBookingFormData({ ...bookingFormData, email: e.target.value })}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    placeholder="client@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Phone</label>
                                <input
                                    type="tel"
                                    required
                                    value={bookingFormData.phone}
                                    onChange={e => setBookingFormData({ ...bookingFormData, phone: e.target.value })}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    placeholder="0400 000 000"
                                />
                            </div>

                            <div className="pt-4 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setBookingModalOpen(false)}
                                    className="flex-1 py-3.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={bookingSubmitting}
                                    className="flex-1 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {bookingSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Schedule"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CalendarPage() {
    return (
        <Suspense fallback={
            <div className="h-full w-full flex flex-col items-center justify-center p-12 bg-white rounded-[2rem] border border-zinc-200 shadow-xl">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-4" />
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Initializing Uplink...</p>
            </div>
        }>
            <CalendarContent />
        </Suspense>
    );
}
