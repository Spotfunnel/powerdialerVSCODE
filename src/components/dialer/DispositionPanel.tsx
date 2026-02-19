"use client";

import { useLead } from "@/contexts/LeadContext";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
    XOctagon,
    MinusCircle,
    CheckCircle,
    Calendar,
    Ban,
    Clock,
    Check,
    FileEdit,
    AlertCircle,
    User,
    Mail,
    Phone,
    Zap,
    Loader2,
    ChevronLeft,
    ChevronRight,
    SkipForward,
    Globe,
    Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generateAESTSlots, TimeSlot, calculateAvailability } from "@/lib/calendar-logic";
import { useNotification } from "@/contexts/NotificationContext";

const outcomes = [
    { label: "NA", status: "NO_ANSWER", color: "zinc", icon: XOctagon, key: "1" },
    { label: "NI", status: "NOT_INTERESTED", color: "zinc", icon: MinusCircle, key: "2" },
    { label: "BOOKED", status: "BOOKED", color: "teal", icon: CheckCircle, key: "3" },
    { label: "CB", status: "CALLBACK", color: "zinc", icon: Calendar, key: "4" },
    { label: "DQ", status: "DQ", color: "zinc", icon: Ban, key: "5" },
];

export function DispositionPanel() {
    const { currentLead, updateLeadStatus, addEvent, fetchNextLead, fetchPreviousLead } = useLead();
    const [showSchedule, setShowSchedule] = useState<"callback" | "booking" | "pipeline" | null>(null);
    const [bookingStep, setBookingStep] = useState<'details' | 'message' | 'selection' | 'processing' | 'done'>('details');
    const [selectedRep, setSelectedRep] = useState<{ id: string, name: string } | null>(null);
    const [specialists, setSpecialists] = useState<{ id: string, name: string }[]>([]);
    const [customMessage, setCustomMessage] = useState("");
    const { addNotification } = useNotification();

    // Booking Form State
    const [bookingData, setBookingData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: ""
    });
    const [bookingDate, setBookingDate] = useState(new Date());
    const [availSlots, setAvailSlots] = useState<TimeSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [customCallbackMode, setCustomCallbackMode] = useState(false);
    const [notes, setNotes] = useState("");
    const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);
    const [meetingTitle, setMeetingTitle] = useState("");
    const [includeMeetLink, setIncludeMeetLink] = useState(false);
    const [includeCalendarLink, setIncludeCalendarLink] = useState(true);

    const [timezoneOffset, setTimezoneOffset] = useState<number>(11);

    // Reset local state when lead changes
    useEffect(() => {
        setSubmittedStatus(null);
        setNotes("");
        setShowSchedule(null);
        setBookingStep('details');
        setCustomMessage("");
        setIncludeMeetLink(false);
        setIncludeCalendarLink(true);
        setMeetingTitle("");
        setTimezoneOffset(11);
    }, [currentLead?.id]);

    useEffect(() => {
        if (currentLead) {
            setBookingData({
                firstName: currentLead.firstName || "",
                lastName: currentLead.lastName || "",
                email: currentLead.email || "",
                phoneNumber: currentLead.phoneNumber || ""
            });
        }
    }, [currentLead]);

    useEffect(() => {
        const fetchSpecialists = async () => {
            try {
                const res = await fetch("/api/users/specialists");
                const data = await res.json();
                setSpecialists(data);
            } catch (err) {
                console.error("Failed to fetch specialists", err);
            }
        };
        if (showSchedule === "booking") {
            fetchSpecialists();
        }
    }, [showSchedule]);

    useEffect(() => {
        const fetchSlots = async () => {
            if (showSchedule !== "booking") return;
            setLoadingSlots(true);
            try {
                // Ensure we have a base date for the slot generation
                const todayAEDT = new Date(bookingDate);
                const base = generateAESTSlots(todayAEDT);

                const start = new Date(bookingDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(bookingDate);
                end.setHours(23, 59, 59, 999);

                const res = await fetch(`/api/calendar/availability?startDate=${start.toISOString()}&endDate=${end.toISOString()}`);
                const data = await res.json();

                // Even if API fails or returns no events, use base slots
                // calculateAvailability expects (baseSlots, googleEvents, currentUser)
                // We'll pass "Leo" generic for now since we don't have the specific rep selection yet at this stage
                const daily = calculateAvailability(base, data.events || [], "Leo");
                setAvailSlots(daily);
            } catch (err) {
                console.error("Failed to load slots, falling back to base availability", err);
                const base = generateAESTSlots(bookingDate);
                setAvailSlots(base);
            } finally {
                setLoadingSlots(false);
            }
        };
        fetchSlots();
    }, [bookingDate, showSchedule]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
            if (showSchedule) {
                if (e.key === 'Escape') setShowSchedule(null);
                return;
            }
            // If already submitted, N triggers next
            if (submittedStatus) {
                if (e.key.toLowerCase() === 'n') {
                    // LeadContext handles N globally, but we provide visual feedback
                }
                return;
            }

            const outcome = outcomes.find(o => o.key === e.key);
            if (outcome && currentLead) {
                const status = outcome.status;
                if (status === 'CALLBACK') {
                    setShowSchedule("callback");
                    setCustomCallbackMode(false);
                } else if (status === 'BOOKED') {
                    setShowSchedule("booking");
                } else {
                    handleDisposition(status);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentLead, updateLeadStatus, showSchedule, submittedStatus]);

    const { data: session } = useSession();

    const [tempBookingDate, setTempBookingDate] = useState<Date | null>(null);

    const handleNavigation = (direction: 'next' | 'prev') => {
        if (notes.trim().length > 0 && !submittedStatus) {
            if (!confirm("You have unsaved notes. Discard them?")) return;
        }
        if (direction === 'next') fetchNextLead();
        else fetchPreviousLead();
    };

    // Auto-submit effect removed to prevent double-submission loop
    // useEffect(() => {
    //     if (showSchedule === 'booking' && bookingStep === 'processing' && selectedRep && tempBookingDate) {
    //         handleRepSubmit();
    //     }
    // }, [bookingStep, selectedRep]);

    const handleSchedule = (minutes: number, type: "callback" | "booking", customDate?: Date) => {
        let date = customDate;
        if (!date) {
            date = new Date();
            date.setMinutes(date.getMinutes() + minutes);
        }

        if (type === "callback") {
            handleDisposition("CALLBACK", date);
            setShowSchedule(null);
            setCustomCallbackMode(false);
        } else {
            // Step 1: Store date and move to custom message
            setTempBookingDate(date);
            setMeetingTitle(`Spotfunnel x ${bookingData.firstName || 'Client'}`);

            // Generate a default greeting for the message window
            let greeting = `Hi ${bookingData.firstName || 'there'}! This is ${selectedRep?.name || 'SpotFunnel'} confirming our demo for ${date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })} AEST. Looking forward to it!`;
            setCustomMessage(greeting);

            setBookingStep('message');
        }
    };

    const handleRepSubmit = async () => {
        if (!selectedRep) return;
        const date = tempBookingDate;
        if (date) {
            setBookingStep('processing');

            // Pass the captured protocol data back to the lead status update
            await handleDisposition('BOOKED', date, selectedRep.id, { ...bookingData, customMessage });

            setBookingStep('done');

            // Show premium success banner
            addNotification({
                type: 'success',
                title: 'Transmission Secured',
                message: `Protocol dispatched to ${bookingData.firstName}. Calendar Invite Dispatch Confirmed.`
            });

            // Cleanup after a delay
            setTimeout(() => {
                setShowSchedule(null);
                setTempBookingDate(null);
            }, 1500);
        }
    };

    const handleDisposition = async (status: string, nextCallAt?: Date, userId?: string, data?: any) => {
        // Only block if trying to set CALLBACK/BOOKED without a date (initial button click)
        if (status === 'CALLBACK' && !nextCallAt) {
            setShowSchedule("callback");
            return;
        }
        if (status === 'BOOKED' && !nextCallAt) {
            setShowSchedule("booking");
            setBookingStep('details');
            return;
        }

        // Optimistic UI update
        setSubmittedStatus(status);

        // Immediate Auto-Skip for non-booking outcomes
        if (status !== 'BOOKED') {
            fetchNextLead();
        }

        // data can be contactData OR include customMessage
        const contactData = data?.customMessage ? {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phoneNumber: data.phoneNumber
        } : data;

        const customMessage = data?.customMessage;

        try {
            updateLeadStatus(status, nextCallAt, userId, notes, contactData, customMessage, timezoneOffset.toString(), includeMeetLink, includeCalendarLink, meetingTitle);
        } catch (err: any) {
            console.error("Disposition Refused", err);
            addNotification({
                type: 'error',
                title: 'Protocol Failed',
                message: "System Disconnected. Check uplink status."
            });
        }
    };


    if (!currentLead) return null;

    return (
        <div className="flex flex-col gap-4 sm:gap-6 w-full h-full">
            {/* Queue Navigation - Extreme Compact */}
            <div className="flex items-center justify-between px-1 sm:px-2 shrink-0">
                <button
                    onClick={() => handleNavigation('prev')}
                    className="flex items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] font-black text-zinc-400 hover:text-zinc-900 transition-colors uppercase tracking-widest group"
                >
                    <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:-translate-x-0.5 transition-transform" />
                    Back [P]
                </button>
                <div className="h-1 w-1 bg-zinc-200 rounded-full" />
                <button
                    onClick={() => handleNavigation('next')}
                    className="flex items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] font-black text-zinc-400 hover:text-zinc-900 transition-colors uppercase tracking-widest group"
                >
                    Skip / Next [N]
                    <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>

            {/* Horizontal Outcomes Row - Vivid Colors for Positive Actions */}
            <div className="w-full shrink-0">
                {showSchedule === "booking" ? (
                    <div className="bg-zinc-100 border-2 border-zinc-300 p-6 rounded-3xl animate-in slide-in-from-bottom-2 duration-300 shadow-xl relative overflow-hidden">

                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                                Booking Protocol
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                    {bookingStep === 'details' ? "Step 1: Calibration" :
                                        bookingStep === 'message' ? "Step 2: Dispatch" :
                                            bookingStep === 'selection' ? "Step 3: Specialist" :
                                                bookingStep === 'processing' ? "Step 4: Execution" : "Step 5: Secured"}
                                </span>
                                {bookingStep !== 'processing' && bookingStep !== 'done' && (
                                    <button onClick={() => { setShowSchedule(null); setBookingStep('details'); }} className="text-[9px] font-bold text-zinc-500 hover:text-red-500 uppercase tracking-widest leading-none ml-2">Cancel [ESC]</button>
                                )}
                            </div>
                        </div>

                        {bookingStep === 'details' && (
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                {/* Strategic Timezone Strategy - Dynamic Offset */}
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <Globe className="h-3 w-3 text-teal-500" />
                                        Target GMT Offset
                                    </label>
                                    <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                                        <span className="text-[9px] font-black text-zinc-400 pl-2">GMT +</span>
                                        <input
                                            type="number"
                                            value={timezoneOffset}
                                            onChange={(e) => setTimezoneOffset(Number(e.target.value))}
                                            step="0.5"
                                            className="w-12 bg-white text-xs font-black text-zinc-900 border border-zinc-200 rounded px-1 py-0.5 text-center focus:border-teal-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* 6 Identically Sized Tactical Cards */}
                                    {[
                                        { label: "First Name", icon: User, key: "firstName", type: "text", placeholder: "First Name" },
                                        { label: "Last Name", icon: User, key: "lastName", type: "text", placeholder: "Last Name" },
                                        { label: "Invite Email", icon: Mail, key: "email", type: "email", placeholder: "email@company.com" },
                                        { label: "SMS Confirm", icon: Phone, key: "phoneNumber", type: "tel", placeholder: "+61..." }
                                    ].map((field) => (
                                        <div key={field.key} className="bg-white border border-zinc-200 rounded-xl sm:rounded-2xl p-2 sm:p-3 space-y-0.5 sm:space-y-1 shadow-sm h-[56px] sm:h-[72px] flex flex-col justify-center transition-all focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/10">
                                            <label className="text-[7px] sm:text-[8px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 leading-none mb-0.5 sm:mb-1">
                                                <field.icon className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {field.label}
                                            </label>
                                            <input
                                                type={field.type}
                                                value={(bookingData as any)[field.key]}
                                                onChange={(e) => setBookingData({ ...bookingData, [field.key]: e.target.value })}
                                                className="w-full bg-transparent text-[10px] sm:text-xs font-black text-zinc-900 outline-none placeholder:text-zinc-300"
                                                placeholder={field.placeholder}
                                            />
                                        </div>
                                    ))}

                                    <div className="bg-white border border-zinc-200 rounded-xl sm:rounded-2xl p-2 sm:p-3 space-y-0.5 sm:space-y-1 shadow-sm h-[56px] sm:h-[72px] flex flex-col justify-center transition-all focus-within:border-teal-500">
                                        <label className="text-[7px] sm:text-[8px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 leading-none mb-0.5 sm:mb-1">
                                            <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Protocol Date
                                        </label>
                                        <input
                                            type="date"
                                            value={bookingDate.toISOString().split('T')[0]}
                                            onChange={(e) => {
                                                const d = new Date(e.target.value);
                                                d.setHours(bookingDate.getHours(), bookingDate.getMinutes());
                                                setBookingDate(d);
                                            }}
                                            className="w-full bg-transparent text-[10px] sm:text-xs font-black text-zinc-900 outline-none uppercase"
                                        />
                                    </div>
                                    <div className="bg-white border border-zinc-200 rounded-xl sm:rounded-2xl p-2 sm:p-3 space-y-0.5 sm:space-y-1 shadow-sm h-[56px] sm:h-[72px] flex flex-col justify-center transition-all focus-within:border-teal-500">
                                        <label className="text-[7px] sm:text-[8px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 leading-none mb-0.5 sm:mb-1">
                                            <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> TIME (GMT+{timezoneOffset})
                                        </label>
                                        <select
                                            value={(() => {
                                                const targetOffset = timezoneOffset;
                                                // Correct Logic: Simply shift UTC time by the offset and read the UTC components
                                                // This simulates "What time is it in Target Zone?"
                                                const targetTime = new Date(bookingDate.getTime() + (targetOffset * 3600000));
                                                return `${targetTime.getUTCHours().toString().padStart(2, '0')}:${targetTime.getUTCMinutes().toString().padStart(2, '0')}`;
                                            })()}
                                            onChange={(e) => {
                                                const [h, m] = e.target.value.split(':').map(Number);
                                                const targetOffset = timezoneOffset;
                                                const d = new Date(bookingDate);

                                                // We want to create a UTC timestamp such that (UTC + Offset) = H:M
                                                // So UTC = H:M - Offset

                                                // Use d.getDate() etc from local is risky if local date differs from target date.
                                                // But usually acceptable for picking time on "selected day".
                                                // Better approach: Keep the existing Year/Month/Day of the bookingDate (in UTC) 
                                                // and just swap the time?

                                                // Current approach uses Date.UTC with Local Date components. 
                                                // This is fine as long as user is picking time for "Today" as seen locally.

                                                const utcTimestamp = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), h, m) - (targetOffset * 3600000);
                                                setBookingDate(new Date(utcTimestamp));
                                            }}
                                            className="w-full bg-transparent text-xs font-black text-zinc-900 outline-none appearance-none cursor-pointer py-0"
                                        >
                                            {Array.from({ length: 48 }).map((_, i) => {
                                                const h = Math.floor(i / 2);
                                                const m = (i % 2) * 30;
                                                const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                                                return (
                                                    <option key={timeString} value={timeString}>
                                                        {timeString}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                </div>

                                {/* Custom Meeting Title - NEW */}
                                <div className="bg-white border border-zinc-200 rounded-xl sm:rounded-2xl p-2 sm:p-3 space-y-1 shadow-sm transition-all focus-within:border-teal-500 flex flex-col justify-center">
                                    <label className="text-[7px] sm:text-[8px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 leading-none mb-0.5 sm:mb-1">
                                        <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-500" /> Custom Meeting Title
                                    </label>
                                    <input
                                        type="text"
                                        value={meetingTitle}
                                        onChange={(e) => setMeetingTitle(e.target.value)}
                                        className="w-full bg-transparent text-[10px] sm:text-xs font-black text-zinc-900 outline-none placeholder:text-zinc-300"
                                        placeholder="Enter meeting title..."
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={() => {
                                            // Handle Timezone Conversion for the message
                                            const targetOffset = timezoneOffset;

                                            // Create a date object representing the time in Target Zone
                                            // We adds offset to make the UTC components match the Target Zone time
                                            const targetTime = new Date(bookingDate.getTime() + (targetOffset * 3600000));

                                            // Format manually using UTC methods to avoid local timezone interference
                                            const hours = targetTime.getUTCHours();
                                            const minutes = targetTime.getUTCMinutes();
                                            const ampm = hours >= 12 ? 'PM' : 'AM';
                                            const formattedHours = hours % 12 || 12;
                                            const formattedMinutes = minutes.toString().padStart(2, '0');
                                            const clientTimeStr = `${formattedHours}:${formattedMinutes} ${ampm}`;

                                            // Only populate generic template if message is empty - Respecting User Customization
                                            if (!customMessage.trim()) {
                                                // For the date part, we might also want to ensure we show the date at TARGET ZONE, not local
                                                // because 2AM UTC might be Prev Day in LA but Next Day in Sydney.
                                                // We use targetTime (UTC components) for date too.
                                                const day = targetTime.getUTCDate();
                                                const month = targetTime.toLocaleString('default', { month: 'short', timeZone: 'UTC' });
                                                const weekday = targetTime.toLocaleString('default', { weekday: 'long', timeZone: 'UTC' });

                                                let greeting = `Hi ${bookingData.firstName || 'there'}! This is SpotFunnel confirming our demo for ${weekday}, ${month} ${day} at ${clientTimeStr} (GMT+${timezoneOffset}). Looking forward to it!`;
                                                setCustomMessage(greeting);
                                            }

                                            setTempBookingDate(bookingDate);
                                            setBookingStep('message');
                                        }}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] flex items-center justify-center gap-2 border-b-4 border-emerald-800"
                                    >
                                        Next: Pre-type Dispatch Message
                                        <ChevronRight className="h-4 w-4 stroke-[3]" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {bookingStep === 'message' && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 tracking-widest flex items-center gap-2">
                                            <Zap className="h-4 w-4 text-teal-500" />
                                            Pre-type Dispatch Message
                                        </label>
                                        <span className="text-[8px] font-bold text-zinc-400 uppercase">SMS & Email Ready</span>
                                    </div>
                                    <textarea
                                        value={customMessage}
                                        onChange={(e) => setCustomMessage(e.target.value)}
                                        className="w-full h-24 sm:h-32 bg-white border-2 border-zinc-100 rounded-2xl sm:rounded-[2rem] p-3 sm:p-5 text-[10px] sm:text-xs font-bold text-zinc-900 focus:outline-none focus:border-teal-500 transition-all resize-none shadow-sm leading-relaxed"
                                        placeholder="Customize the greeting message..."
                                    />
                                    <div className="flex flex-col gap-2">
                                        <div
                                            onClick={() => setIncludeMeetLink(!includeMeetLink)}
                                            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer select-none ${includeMeetLink ? 'bg-teal-50 border-teal-200' : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'}`}
                                        >
                                            <div className={`h-6 w-6 rounded-lg flex items-center justify-center border transition-colors ${includeMeetLink ? 'bg-teal-500 border-teal-500' : 'bg-white border-zinc-300'}`}>
                                                {includeMeetLink && <Check className="h-4 w-4 text-white stroke-[3]" />}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-[10px] font-black uppercase tracking-wider ${includeMeetLink ? 'text-teal-900' : 'text-zinc-500'}`}>
                                                    Include Google Meet Link
                                                </p>
                                                <p className="text-[9px] font-medium text-zinc-400">
                                                    {includeMeetLink ? 'Link will be appended to the SMS automatically' : 'No meeting link will be sent'}
                                                </p>
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => setIncludeCalendarLink(!includeCalendarLink)}
                                            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer select-none ${includeCalendarLink ? 'bg-indigo-50 border-indigo-200' : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'}`}
                                        >
                                            <div className={`h-6 w-6 rounded-lg flex items-center justify-center border transition-colors ${includeCalendarLink ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-zinc-300'}`}>
                                                {includeCalendarLink && <Check className="h-4 w-4 text-white stroke-[3]" />}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-[10px] font-black uppercase tracking-wider ${includeCalendarLink ? 'text-indigo-900' : 'text-zinc-500'}`}>
                                                    Include Calendar Invite Link
                                                </p>
                                                <p className="text-[9px] font-medium text-zinc-400">
                                                    {includeCalendarLink ? 'Link to full calendar invite will be appended' : 'No calendar page link sent'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setBookingStep('details')}
                                        className="w-1/3 py-4 bg-zinc-200 hover:bg-zinc-300 text-zinc-600 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={() => setBookingStep('selection')}
                                        className="flex-1 py-4 bg-zinc-900 hover:bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl flex items-center justify-center gap-2"
                                    >
                                        Confirm & Select Rep
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {bookingStep === 'selection' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="flex flex-col items-center justify-center text-center space-y-3 bg-white p-6 rounded-2xl border border-dashed border-zinc-200">
                                    <div className="h-12 w-12 rounded-2xl bg-teal-50 flex items-center justify-center">
                                        <Clock className="h-6 w-6 text-teal-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Protocol Window Target</p>
                                        <h3 className="text-xl font-black text-zinc-900 italic">
                                            {tempBookingDate?.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })} @ {tempBookingDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </h3>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[9px] font-black text-zinc-500 uppercase ml-1 tracking-widest">Deploy Specialist Account</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {specialists.map(rep => (
                                            <button
                                                key={rep.id}
                                                onClick={() => setSelectedRep(rep)}
                                                className={`
                                                    py-4 rounded-2xl border-2 transition-all group flex flex-col items-center gap-1
                                                    ${selectedRep?.id === rep.id
                                                        ? "bg-teal-600 border-teal-500 text-white shadow-lg shadow-teal-500/20"
                                                        : "bg-white border-zinc-100 text-zinc-600 hover:border-teal-500 hover:bg-teal-50"
                                                    }
                                                `}
                                            >
                                                <User className={`h-5 w-5 ${selectedRep?.id === rep.id ? "text-white" : "text-zinc-400"}`} />
                                                <span className="text-[10px] font-black uppercase tracking-widest italic">{rep.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setBookingStep('message')}
                                        className="w-1/3 py-4 bg-zinc-200 hover:bg-zinc-300 text-zinc-600 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleRepSubmit}
                                        disabled={!selectedRep}
                                        className={`
                                            flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3
                                            ${selectedRep
                                                ? "bg-zinc-900 border-2 border-zinc-800 text-white hover:bg-black"
                                                : "bg-zinc-100 border-2 border-zinc-100 text-zinc-300 cursor-not-allowed"
                                            }
                                        `}
                                    >
                                        <Zap className={`h-4 w-4 ${selectedRep ? "text-yellow-400 animate-pulse" : "text-zinc-300"}`} />
                                        Launch Protocol
                                    </button>
                                </div>
                            </div>
                        )}

                        {bookingStep === 'processing' && (
                            <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
                                <div className="relative">
                                    <div className="h-16 w-16 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Zap className="h-6 w-6 text-emerald-500 fill-current animate-pulse" />
                                    </div>
                                </div>
                                <div className="space-y-2 w-full max-w-xs mx-auto">
                                    <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                        <Check className="h-3 w-3 text-emerald-500" /> {includeMeetLink ? "Generating Google Meet Link..." : "Creating Calendar Event..."}
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider animation-delay-200">
                                        <Check className="h-3 w-3 text-emerald-500" /> Dispatching Calendar Invites...
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider animation-delay-400">
                                        <Loader2 className="h-3 w-3 text-emerald-500 animate-spin" /> Sending SMS Confirmation...
                                    </div>
                                </div>
                            </div>
                        )}

                        {bookingStep === 'done' && (
                            <div className="py-6 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
                                <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                    <Check className="h-10 w-10 text-emerald-600 stroke-[3]" />
                                </div>
                                <h3 className="text-xl font-black text-zinc-900 italic tracking-tight mb-1">Booking Secured</h3>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-6">All automated protocols executed successfully</p>
                                <button
                                    onClick={() => fetchNextLead()}
                                    className="px-8 py-3 bg-zinc-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all"
                                >
                                    Complete & Next Lead
                                </button>
                            </div>
                        )}

                    </div>
                ) : showSchedule === 'callback' ? (
                    <div className="bg-zinc-100 border-2 border-zinc-300 p-5 rounded-3xl animate-in slide-in-from-bottom-2 duration-300 shadow-sm">
                        {/* Callback Logic (Simplified Tier 2 Support) */}
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                                Retention Protocol
                            </h4>
                            <button onClick={() => setShowSchedule(null)} className="text-[9px] font-bold text-zinc-500 hover:text-zinc-900 uppercase tracking-widest leading-none">Cancel [ESC]</button>
                        </div>
                        {!customCallbackMode ? (
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <button
                                    onClick={() => handleSchedule(15, "callback")}
                                    className="h-10 border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-600 transition-all active:scale-95"
                                >
                                    15 Min
                                </button>
                                <button
                                    onClick={() => handleSchedule(60, "callback")}
                                    className="h-10 border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-600 transition-all active:scale-95"
                                >
                                    1 Hour
                                </button>
                                <button
                                    onClick={() => handleSchedule(120, "callback")}
                                    className="h-10 border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-600 transition-all active:scale-95"
                                >
                                    2 Hours
                                </button>
                                <button
                                    onClick={() => handleSchedule(240, "callback")}
                                    className="h-10 border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-600 transition-all active:scale-95"
                                >
                                    4 Hours
                                </button>
                                <button
                                    onClick={() => {
                                        const tomorrow = new Date();
                                        tomorrow.setDate(tomorrow.getDate() + 1);
                                        tomorrow.setHours(9, 0, 0, 0);
                                        handleSchedule(0, "callback", tomorrow);
                                    }}
                                    className="h-10 border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-600 transition-all active:scale-95"
                                >
                                    Tomorrow 9am
                                </button>
                                <button
                                    onClick={() => setCustomCallbackMode(true)}
                                    className="h-10 border border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 transition-all active:scale-95"
                                >
                                    Custom
                                </button>
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="flex gap-4 mb-4">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-[8px] font-black text-zinc-500 uppercase ml-1">Callback Date</label>
                                        <input type="date" className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-900 focus:border-teal-500 outline-none shadow-sm" id="callback-date" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <label className="text-[8px] font-black text-zinc-500 uppercase ml-1">Callback Time</label>
                                        <input type="time" className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-900 focus:border-teal-500 outline-none shadow-sm" id="callback-time" />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setCustomCallbackMode(false)}
                                        className="w-1/3 py-3.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={() => {
                                            const d = (document.getElementById('callback-date') as HTMLInputElement).value;
                                            const t = (document.getElementById('callback-time') as HTMLInputElement).value;
                                            if (d && t) handleSchedule(0, "callback", new Date(`${d}T${t}`));
                                        }}
                                        className="flex-1 py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Calendar className="h-4 w-4 stroke-[2.5]" />
                                        Set Callback
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex gap-2 sm:gap-3 w-full overflow-x-auto pb-2 sm:pb-0 snap-x hide-scrollbar">
                        {outcomes.map((outcome) => (
                            <button
                                key={outcome.label}
                                onClick={() => handleDisposition(outcome.status)}
                                className={cn(
                                    "flex-1 min-w-[65px] sm:min-w-0 flex flex-col items-center justify-center gap-1 sm:gap-1.5 py-2.5 sm:py-4 rounded-xl sm:rounded-3xl border transition-all active:scale-95 group relative overflow-hidden snap-start",
                                    outcome.color === 'teal' // BOOKED
                                        ? "bg-teal-600 border-teal-500 shadow-xl shadow-teal-500/20 text-white hover:bg-teal-700 active:animate-pulse active:bg-emerald-600 active:border-emerald-500 active:shadow-emerald-500/40"
                                        : outcome.status === 'CALLBACK' // CB
                                            ? "bg-white border-2 border-zinc-300 hover:border-zinc-400 text-zinc-800 hover:bg-zinc-50 shadow-sm active:animate-pulse active:bg-emerald-50 active:border-emerald-200 active:text-emerald-700"
                                            : "bg-white border-2 border-zinc-300 hover:border-zinc-400 text-zinc-800 hover:bg-zinc-50 shadow-sm active:animate-pulse active:bg-red-50 active:border-red-200 active:text-red-600" // 1, 2, 5
                                )}
                            >
                                <outcome.icon className={cn(
                                    "h-3.5 w-3.5 sm:h-5 sm:w-5 stroke-[2.5]",
                                    (outcome.color === 'emerald' || outcome.color === 'teal') ? "text-white" : "text-zinc-400 group-hover:text-zinc-900"
                                )} />
                                <span className={cn(
                                    "text-[8px] sm:text-[10px] font-black uppercase tracking-tight",
                                    (outcome.color === 'emerald' || outcome.color === 'teal') ? "text-white" : "text-zinc-800"
                                )}>{outcome.label}</span>
                                <span className={cn(
                                    "absolute bottom-1 right-2 text-[8px] font-black",
                                    (outcome.color === 'emerald' || outcome.color === 'teal') ? "text-white/90" : "text-zinc-600"
                                )}>{outcome.key}</span>
                            </button>
                        ))}
                    </div>
                )
                }

                {/* Pipeline Actions Toggle */}
                <div className="flex justify-end mt-2">
                    <button
                        onClick={() => setShowSchedule(showSchedule === 'pipeline' ? null : 'pipeline')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 transition-colors border-2 border-transparent hover:border-zinc-200 rounded-lg hover:bg-zinc-50"
                    >
                        <Briefcase className="h-3 w-3" />
                        Pipeline Actions
                    </button>
                </div>

                {/* Pipeline Actions Menu */}
                {showSchedule === 'pipeline' && (
                    <div className="mt-2 bg-white border border-zinc-200 rounded-2xl p-4 animate-in slide-in-from-top-2 shadow-lg relative z-20">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-indigo-500" />
                                Manual Pipeline Override
                            </h4>
                            <button onClick={() => setShowSchedule(null)} className="text-[9px] font-bold text-zinc-500 hover:text-red-500 uppercase">Close</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={async () => {
                                    if (confirm("Confirm: Force move to 'Demo Booked'?")) {
                                        try {
                                            setSubmittedStatus("BOOKED");
                                            await fetch("/api/crm/pipeline-move", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ leadId: currentLead?.id, stage: "BOOKED", notes: notes })
                                            });
                                            addNotification({
                                                type: 'success',
                                                title: 'Override Engaged',
                                                message: "Forced to Demo Booked"
                                            });
                                            setTimeout(() => { setShowSchedule(null); fetchNextLead(); }, 1500);
                                        } catch (e) {
                                            console.error(e);
                                            addNotification({ type: 'error', title: 'Override Refused', message: 'Uplink failed.' });
                                        }
                                    }
                                }}
                                className="h-14 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-300 rounded-xl flex items-center justify-center gap-2 text-indigo-700 font-bold text-[10px] uppercase tracking-wide transition-all shadow-sm active:scale-95"
                            >
                                <Calendar className="h-4 w-4" /> Force Demo Booked
                            </button>
                            <button
                                onClick={async () => {
                                    if (confirm("Confirm: Mark as 'Sold' / Closed Won?")) {
                                        try {
                                            setSubmittedStatus("SOLD");
                                            await fetch("/api/crm/pipeline-move", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ leadId: currentLead?.id, stage: "SOLD", notes: notes })
                                            });
                                            addNotification({
                                                type: 'success',
                                                title: 'Override Engaged',
                                                message: "Marked as SOLD"
                                            });
                                            setTimeout(() => { setShowSchedule(null); fetchNextLead(); }, 1500);
                                        } catch (e) {
                                            console.error(e);
                                            addNotification({ type: 'error', title: 'Override Refused', message: 'Uplink failed.' });
                                        }
                                    }
                                }}
                                className="h-14 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 hover:border-emerald-300 rounded-xl flex items-center justify-center gap-2 text-emerald-700 font-bold text-[10px] uppercase tracking-wide transition-all shadow-sm active:scale-95"
                            >
                                <CheckCircle className="h-4 w-4" /> Mark as Sold
                            </button>
                        </div>
                    </div>
                )}
            </div >


            {/* Dominant Data Capture Plane */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3 px-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 flex items-center gap-2">
                        <FileEdit className="h-4 w-4 text-teal-600" />
                        Session Intelligence
                    </h3>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[8px] uppercase tracking-widest text-emerald-700 font-black">Live Capture</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 relative group">
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="ANALYZE TRANSMISSION: Key leverage points, friction areas, next steps..."
                        // Disable notes editing if submitted to prevent confusion, OR allow editing and re-submitting?
                        // For now, allow editing but it won't be saved again unless they click something else. 
                        // To keep it simple: assume notes are final when button clicked. 
                        disabled={!!submittedStatus}
                        className={cn(
                            "w-full h-full bg-zinc-100/50 border border-zinc-200 rounded-[2.5rem] p-8 text-sm font-bold text-zinc-900 focus:outline-none focus:border-teal-500 focus:bg-white transition-all resize-none shadow-inner placeholder:text-zinc-400 placeholder:italic leading-relaxed custom-scrollbar font-sans",
                            submittedStatus && "opacity-60 bg-zinc-50 cursor-not-allowed"
                        )}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                    {/* Visual Focus Indicator */}
                    <div className="absolute bottom-6 right-8 opacity-0 group-focus-within:opacity-100 transition-opacity">
                        <span className="text-[9px] font-black text-teal-600 uppercase tracking-widest">Active Input</span>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between px-6">
                    <div className="flex items-center gap-6">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] italic">Prioritizing intelligence fidelity</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="px-2 py-0.5 rounded-md bg-zinc-100 text-[8px] font-bold text-zinc-500 uppercase tracking-widest border border-zinc-200">Autosave Protocol</div>
                    </div>
                </div>
            </div>
        </div >
    );
}
