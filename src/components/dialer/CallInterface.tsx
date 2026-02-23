"use client";

import { useState, useEffect } from "react";
import { Phone, PhoneOff, Mic, MicOff, Loader2, Building2, AlertCircle, Globe, ExternalLink, History, Clock, CheckCircle2, CassetteTape } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLead } from "@/contexts/LeadContext";
import { useTwilio } from "@/contexts/TwilioContext";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { useNotification } from "@/contexts/NotificationContext";
import { useSwipeable } from "react-swipeable";

export function CallInterface({ onToggleMessages, showMessages }: { onToggleMessages?: () => void; showMessages?: boolean }) {
    const router = useRouter();
    const { currentLead, updateLeadStatus, events, addEvent, setStats, loading, campaignId, setCampaignId, fetchNextLead } = useLead();
    const { addNotification } = useNotification();
    const [sendingLink, setSendingLink] = useState(false);

    const {
        deviceState,
        deviceError,
        activeConnection,
        activeCallDuration,
        incomingConnection,
        isMuted,
        dial,
        answer,
        reject,
        hangup,
        toggleMute,
        outboundCallerId
    } = useTwilio();

    const [localCallState, setLocalCallState] = useState<'idle' | 'dialing'>('idle');
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [recentCalls, setRecentCalls] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [leadHistory, setLeadHistory] = useState<any[]>([]);

    const fetchRecentCalls = async () => {
        try {
            const res = await fetch('/api/calls/recent');
            if (res.ok) {
                const data = await res.json();
                setRecentCalls(data);
            }
        } catch (err) {
            console.error("Failed to fetch recent calls", err);
        }
    };

    const fetchLeadHistory = async (leadId: string) => {
        try {
            const res = await fetch(`/api/calls/recent?leadId=${leadId}`);
            if (res.ok) {
                const data = await res.json();
                setLeadHistory(data);
            }
        } catch (err) {
            console.error("Failed to fetch lead history", err);
        }
    };

    useEffect(() => {
        if (currentLead?.id) {
            fetchLeadHistory(currentLead.id);
        } else {
            setLeadHistory([]);
        }
    }, [currentLead?.id]);

    useEffect(() => {
        fetch('/api/campaigns')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setCampaigns(data);
            })
            .catch(err => console.error("Failed to fetch campaigns", err));

        fetchRecentCalls();
    }, []);

    // Swipe handlers for mobile interaction
    const swipeHandlers = useSwipeable({
        onSwipedRight: () => {
            if (isIncoming) {
                answer();
                addNotification({
                    type: 'success',
                    title: 'Call Answered',
                    message: 'Uplink established via gesture.'
                });
            }
        },
        onSwipedLeft: () => {
            if (isIncoming) {
                reject();
                addNotification({
                    type: 'info',
                    title: 'Call Declined',
                    message: 'Inbound transmission rejected.'
                });
            } else if (isConnected) {
                hangup();
                addNotification({
                    type: 'info',
                    title: 'Call Ended',
                    message: 'Connection terminated via gesture.'
                });
            }
        },
        trackMouse: true
    });

    // DERIVED STATE
    const isConnected = !!activeConnection;
    // Only show incoming in this component if not already active (or to provide a secondary answer button)
    // The GlobalCallOverlay mostly handles this, but it's good to have here too if the user is on the dialer.
    const isIncoming = !!incomingConnection && !activeConnection;

    const isReconnecting = deviceState === 'reconnecting';
    const isSystemReady = deviceState === 'ready';

    // Sync local dialing state with global active connection
    useEffect(() => {
        if (activeConnection) {
            setLocalCallState('idle');
            updateLeadStatus("TALKING");
        } else if (!activeConnection && localCallState === 'idle') {
            // Call just ended or we are idle
            fetchRecentCalls();
            if (currentLead?.id) fetchLeadHistory(currentLead.id);
        }
    }, [activeConnection, updateLeadStatus, currentLead?.id]);

    // ... (rest of code)

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleCall = async () => {
        if (!currentLead?.phoneNumber || !isSystemReady) return;
        setLocalCallState('dialing');
        try {
            await dial(currentLead.phoneNumber);

            // Log the call to DB
            fetch('/api/call/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId: currentLead.id })
            }).catch(e => console.error("Failed to log call stats:", e));

            // Optimistic Update
            // Optimistic Update
            setStats(prev => ({ ...prev, calls: (prev.calls || 0) + 1 }));

            // Notification removed - user doesn't want notifications for outbound calls they initiate
        } catch (e: any) {
            setLocalCallState('idle');
            // Suppressing spurious "Dialing Failed" error as per user request (calls are working)
            console.error("Dialing error suppressed:", e);
            // addNotification({
            //     type: 'error',
            //     title: 'Dialing Failed',
            //     message: e.message || 'Check terminal status.'
            // });
        }
    };

    const [droppingVm, setDroppingVm] = useState(false);

    const handleVmDrop = async () => {
        if (!activeConnection) return;
        setDroppingVm(true);
        try {
            // Get CallSid from connection parameters
            // @ts-ignore - access internal parameters
            const callSid = activeConnection.parameters?.CallSid;
            if (!callSid) throw new Error("No Call SID available");

            const res = await fetch('/api/call/vm-drop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callSid })
            });

            if (res.ok) {
                addNotification({
                    type: 'success',
                    title: 'Voicemail Drop',
                    message: 'VM drop initiated. Call will end shortly.'
                });
                // Optional: Disconnect immediately or wait for TwiML to hangup
                // activeConnection.disconnect(); 
            } else {
                throw new Error("Failed to trigger VM drop");
            }
        } catch (e) {
            console.error(e);
            addNotification({
                type: 'error',
                title: 'Drop Failed',
                message: 'Could not drop voicemail.'
            });
        } finally {
            setDroppingVm(false);
        }
    };

    const sendMeetingLink = async () => {
        if (!currentLead?.phoneNumber || sendingLink) return;
        setSendingLink(true);
        try {
            // MVP: Default link
            const meetLink = "https://meet.google.com/lookup/auto-generated"; // Replace with real logic/settings
            const body = `Hi ${currentLead.firstName}, here is the link for our meeting: ${meetLink}`;

            const res = await fetch("/api/messaging/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to: currentLead.phoneNumber,
                    leadId: currentLead.id,
                    body
                })
            });

            if (res.ok) {
                addNotification({
                    type: 'success',
                    title: 'Meeting Link Sent',
                    message: `SMS link delivered to ${currentLead.firstName}`
                });
                router.push("/messaging");
            } else {
                addNotification({
                    type: 'error',
                    title: 'SMS Failed',
                    message: 'Could not deliver meeting link.'
                });
            }
        } catch (error) {
            console.error("Error sending meet link", error);
        } finally {
            setSendingLink(false);
        }
    };

    // Keyboard shortcut for calling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (
                ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
                target.isContentEditable
            ) return;

            // Ignore modifiers to prevent conflicts
            if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

            if (e.code === 'KeyD') {
                e.preventDefault();
                if (isConnected || isIncoming || localCallState !== 'idle') return;
                console.log("Dial shortcut triggered");
                handleCall();
            }

            if (e.code === 'KeyH') {
                if (!isConnected) return;
                e.preventDefault();
                console.log("Hangup shortcut triggered");
                hangup();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isConnected, isIncoming, localCallState, isSystemReady, currentLead]);



    if ((loading || isReconnecting) && !currentLead && !isIncoming) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-teal-600 stroke-[3]" />
                    <p className="text-xs font-black text-zinc-900 uppercase tracking-widest">
                        {isReconnecting ? "Re-establishing Uplink..." : "Initializing Secure Connection..."}
                    </p>
                </div>
            </div>
        );
    }

    if (!currentLead && !isIncoming) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
                <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-5 w-5" />
                        <p className="text-xs font-black uppercase tracking-widest">Queue Unreachable</p>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase text-center max-w-[200px]">
                        The server is busy or the queue is empty.
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95"
                        >
                            Retry
                        </button>
                        <button
                            onClick={() => router.push("/contacts")}
                            className="px-4 py-2 bg-zinc-50 hover:bg-zinc-100 text-[10px] font-black uppercase tracking-widest text-teal-700 rounded-lg border-2 border-zinc-200 transaction-all"
                        >
                            Go to Contacts
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div {...swipeHandlers} className="relative w-full flex flex-col items-center gap-2 sm:gap-8 py-0.5 sm:py-2 overflow-hidden touch-none">
            {/* Mobile Swipe Indicators (Only visible during incoming/active) */}
            {(isIncoming || isConnected) && (
                <div className="absolute inset-x-0 top-0 flex justify-between px-4 py-2 lg:hidden pointer-events-none opacity-20">
                    {/* ... (existing swipe indicators) ... */}
                </div>
            )}

            {/* TOP LEFT RE-ORGANIZED: Campaign + Lead History + Notes */}
            <div className="absolute top-2 left-2 z-20 flex flex-col gap-4 p-2 overflow-visible">
                {/* CAMPAIGN SELECTOR */}
                <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-xl border border-zinc-200/50 shadow-sm">
                    <Building2 className="h-4 w-4 text-teal-600 shrink-0" />
                    <select
                        value={campaignId || ""}
                        onChange={(e) => {
                            setCampaignId(e.target.value || null);
                        }}
                        className="bg-transparent text-[11px] font-black uppercase tracking-widest text-zinc-700 border-none outline-none cursor-pointer hover:text-teal-600 focus:ring-0 py-0 pl-0 pr-6"
                    >
                        <option value="">All Campaigns</option>
                        {campaigns.map((c: any) => (
                            <option key={c.id} value={c.id}>
                                {c.name} {c._count ? `(${c._count.leads})` : ""}
                            </option>
                        ))}
                    </select>
                </div>

                {/* LEAD SPECIFIC HISTORY LOG - Standalone barely visible cards */}
                {leadHistory.length > 0 && (
                    <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-4 duration-700">
                        <div className="flex items-center gap-2 mb-1 px-1">
                            <div className="h-1 w-1 rounded-full bg-teal-500 animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 font-mono">Engagement</span>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            {leadHistory.slice(0, 3).map((call, idx) => (
                                <div
                                    key={call.id}
                                    className="flex flex-col gap-1.5 p-3 rounded-[1.25rem] bg-white/40 backdrop-blur-md border border-zinc-200/50 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:bg-white/90 transition-all group max-w-[210px] ring-1 ring-white"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[9px] font-black text-zinc-400 font-mono uppercase">
                                            {new Date(call.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                        </span>
                                        <div className={cn(
                                            "px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter border",
                                            call.status === 'COMPLETED'
                                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                                : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                                        )}>
                                            {call.status}
                                        </div>
                                    </div>
                                    {call.notes && (
                                        <p className="text-[9px] leading-relaxed text-zinc-500 font-medium line-clamp-2 group-hover:line-clamp-none transition-all">
                                            {call.notes}
                                        </p>
                                    )}
                                    {call.recordingUrl && (
                                        <div className="mt-1 flex items-center gap-2 bg-zinc-50 rounded-lg p-1 border border-zinc-100">
                                            <CassetteTape className="h-3 w-3 text-zinc-400" />
                                            <audio controls className="h-6 w-full max-w-[140px] [&::-webkit-media-controls-panel]:bg-transparent">
                                                <source src={call.recordingUrl} type="audio/wav" />
                                                <source src={call.recordingUrl} type="audio/mpeg" />
                                            </audio>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* CORNER NOTES */}
                {currentLead?.notes && (
                    <div className="flex flex-col gap-0.5 opacity-60 hover:opacity-100 transition-opacity max-w-[180px]">
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Previous Note</span>
                        <p className="text-[10px] leading-tight font-medium text-zinc-600 line-clamp-3 bg-zinc-50/50 p-1.5 rounded border border-zinc-100 shadow-sm">
                            {currentLead.notes}
                        </p>
                    </div>
                )}
            </div>

            {/* CORNER STATUS: System Ready / Live Indicator (Top Right) */}
            <div className="absolute top-0 right-0 flex items-center gap-2">
                {deviceError ? (
                    <div className="text-[8px] font-bold text-red-700 flex items-center gap-1 bg-red-50 px-2 py-1 rounded border border-red-200" title={deviceError.message}>
                        <AlertCircle className="h-3 w-3 stroke-[2.5]" />
                        <span>{deviceError.message || "Error"}</span>
                    </div>
                ) : isReconnecting ? (
                    <div className="flex items-center gap-2 opacity-100 animate-pulse">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest leading-none">
                            Reconnecting...
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 opacity-60">
                        <div className={cn("h-1.5 w-1.5 rounded-full transition-colors", isSystemReady ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-red-500")} />
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">
                            {isSystemReady ? "System Ready" : "Offline"}
                        </span>
                    </div>
                )}
            </div>

            {/* LAYER 1: Identity & Info (Centered) */}
            <div className="flex flex-col items-center text-center mt-1 sm:mt-2">
                {isIncoming ? (
                    <div className="animate-pulse">
                        <h2 className="text-2xl sm:text-4xl font-black text-zinc-900 tracking-tight italic leading-none mb-2 sm:mb-3">
                            Incoming Transmission
                        </h2>
                        <span className="text-xs font-black font-mono text-zinc-500 tracking-wider">
                            {incomingConnection?.parameters?.From || "Unknown Caller"}
                        </span>
                    </div>
                ) : (
                    <>
                        {/* MID-CENTER ANALYTICS BAR */}
                        <div className="flex flex-col items-center justify-center gap-1 mb-2 sm:mb-4 w-full max-w-[280px] sm:max-w-sm mx-auto opacity-90 hover:opacity-100 transition-opacity" title="Daily Progress">
                            <div className="flex w-full justify-between items-end px-1">
                                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-teal-700/60">Daily Goal</span>
                                <span className="text-[9px] sm:text-[11px] font-bold text-teal-900 font-mono">
                                    {(currentLead ? (useLead().stats.calls || 0) : 0)} <span className="text-teal-400">/</span> 200
                                </span>
                            </div>
                            <div className="h-1.5 sm:h-2.5 w-full bg-teal-100/60 rounded-full overflow-hidden backdrop-blur-sm shadow-sm border border-teal-100/50">
                                <div
                                    className="h-full bg-teal-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(20,184,166,0.6)]"
                                    style={{ width: `${Math.min(((useLead().stats.calls || 0) / 200) * 100, 100)}%` }}
                                />
                            </div>
                        </div>

                        <h2 className="text-base sm:text-lg font-bold truncate text-zinc-900 max-w-[90vw] sm:max-w-none">
                            {currentLead?.companyName || "Unknown Company"}
                        </h2>
                        {currentLead?.industry && (
                            <p className="text-[10px] sm:text-xs font-semibold text-teal-700 truncate max-w-[90vw] sm:max-w-none">
                                {currentLead.industry}
                            </p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] sm:text-[14px] text-zinc-500">
                            <span className="truncate">
                                {currentLead?.firstName} {currentLead?.lastName}
                            </span>
                            {(currentLead?.suburb || currentLead?.address) && (
                                <>
                                    <span className="text-zinc-300">•</span>
                                    {currentLead.address ? (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentLead.address + (currentLead.suburb ? ', ' + currentLead.suburb : '') + (currentLead.state ? ', ' + currentLead.state : ''))}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-zinc-700 hover:text-primary transition-colors cursor-pointer"
                                        >
                                            {currentLead.address}
                                        </a>
                                    ) : null}
                                    {currentLead.suburb && (
                                        <>
                                            {currentLead.address && <span className="text-zinc-300 ml-1">-</span>}
                                            {currentLead.website ? (
                                                <a
                                                    href={currentLead.website.startsWith('http') ? currentLead.website : `https://${currentLead.website}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-bold text-teal-700 hover:underline cursor-pointer ml-1"
                                                >
                                                    {currentLead.suburb}
                                                </a>
                                            ) : (
                                                <span className="font-medium text-zinc-700 ml-1">{currentLead.suburb}</span>
                                            )}
                                        </>
                                    )}
                                    {currentLead.state && !currentLead.address && (
                                        <span className="text-zinc-500">, {currentLead.state}</span>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-2 sm:gap-5 mt-1 sm:mt-3">
                            <a
                                href={(() => {
                                    if (!currentLead?.website) return '#';
                                    let url = currentLead.website.trim();
                                    if (!url) return '#';
                                    // Remove any common placeholders
                                    if (url.toLowerCase() === 'none' || url.toLowerCase() === 'n/a') return '#';
                                    if (url.startsWith('http')) return url;
                                    return `https://${url}`;
                                })()}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                    const href = (e.currentTarget as HTMLAnchorElement).href;
                                    if (!currentLead?.website || href.endsWith('#')) {
                                        console.warn("Website navigation blocked: invalid URL", currentLead?.website);
                                        e.preventDefault();
                                    }
                                }}
                                className={cn(
                                    "flex items-center gap-1.5 text-[8px] sm:text-[11px] font-black uppercase tracking-[0.2em] italic group transition-colors truncate max-w-[100px] sm:max-w-none",
                                    currentLead?.website ? "text-teal-700 hover:text-teal-500 cursor-pointer" : "text-zinc-300 cursor-not-allowed"
                                )}
                            >
                                <Building2 className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 stroke-[2.5]" />
                                <span className="truncate">{currentLead?.companyName}</span>
                                {currentLead?.website && (
                                    <ExternalLink className="h-2 sm:h-3 w-2 sm:w-3 stroke-[2.5] opacity-40 group-hover:opacity-100 transition-opacity" />
                                )}
                            </a>

                            <div className="h-0.5 w-0.5 bg-zinc-300 rounded-full" />

                            <span className="text-[10px] sm:text-sm font-black font-mono text-zinc-800 tracking-wider">
                                {currentLead?.phoneNumber}
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* TIMER (Always Visible, Clean Animation) */}
            <div className="flex flex-col items-center justify-center h-12 sm:h-16 w-full relative z-10">
                {/* IDLE: 00:00 (Zinc) // ACTIVE: Real Time (Emerald) */}
                <div className={cn(
                    "text-2xl sm:text-5xl font-black font-mono tracking-widest transition-all duration-700 select-none",
                    isConnected
                        ? "text-emerald-500 scale-110 drop-shadow-sm"
                        : "text-zinc-200 scale-100"
                )}>
                    {isConnected ? formatTime(activeCallDuration) : "00:00"}
                </div>
            </div>

            {/* LAYER 2: Action (Centered Below) */}
            <div className="relative">
                {/* IDLE STATE: Show Big Call Button */}
                {!isConnected && (
                    <button
                        onClick={handleCall}
                        disabled={localCallState === 'dialing' || isIncoming}
                        className={cn(
                            "h-24 w-24 sm:h-32 sm:w-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl relative group overflow-hidden",
                            localCallState === 'dialing'
                                ? "bg-amber-100/50 scale-95"
                                : "bg-emerald-600 hover:bg-emerald-500 hover:scale-105 active:scale-90 shadow-emerald-500/30"
                        )}
                    >
                        {localCallState === 'dialing' ? (
                            <Loader2 className="h-10 w-10 sm:h-14 sm:w-14 text-amber-600 animate-spin" />
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Phone className="h-10 w-10 sm:h-14 sm:w-14 text-white fill-current group-hover:rotate-12 transition-transform" />
                            </>
                        )}
                    </button>
                )}

                {/* ACTIVE STATE: Show Hangup Button */}
                {isConnected && (
                    <button
                        onClick={hangup}
                        className="h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-red-600 flex items-center justify-center transition-all duration-500 shadow-2xl shadow-red-500/40 hover:bg-red-500 hover:scale-105 active:scale-90 relative group overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <PhoneOff className="h-10 w-10 sm:h-14 sm:w-14 text-white fill-current group-hover:-rotate-12 transition-transform" />
                    </button>
                )}

                {/* INCOMING STATE: Answer/Reject handled by Overlay or this card */}
                {isIncoming && (
                    <div className="flex gap-6 animate-in zoom-in-90 duration-300">
                        <button onClick={reject} className="h-20 w-20 rounded-full bg-zinc-100 text-red-600 flex items-center justify-center hover:bg-red-50 transition-colors border-2 border-zinc-200">
                            <PhoneOff className="h-8 w-8" />
                        </button>
                        <button onClick={answer} className="h-20 w-20 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg hover:bg-emerald-500 transition-colors">
                            <Phone className="h-8 w-8 fill-current" />
                        </button>
                    </div>
                )}
                {/* SECONDARY CONTROLS */}
                {isConnected && (
                    <div className="flex items-center gap-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-50">
                        <button
                            onClick={toggleMute}
                            className={cn(
                                "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm",
                                isMuted ? "bg-red-50 text-red-600 ring-1 ring-red-200" : "bg-white text-zinc-600 hover:bg-zinc-50 ring-1 ring-zinc-200"
                            )}
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                        </button>

                        <button
                            onClick={handleVmDrop}
                            disabled={droppingVm}
                            className="h-12 px-6 rounded-full bg-white hover:bg-teal-50 text-zinc-600 hover:text-teal-700 flex items-center gap-2 transition-all duration-300 font-bold text-[10px] uppercase tracking-wider ring-1 ring-zinc-200 hover:ring-teal-200 shadow-sm"
                            title="Drop Voicemail"
                        >
                            {droppingVm ? (
                                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                            ) : (
                                <CassetteTape className="h-4 w-4" />
                            )}
                            <span>Drop VM</span>
                        </button>
                    </div>
                )}
            </div>

            {/* RECENT HISTORY OVERLAY (Bottom Right) */}
            <div className="absolute bottom-6 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
                {showHistory && (
                    <div className="flex flex-col gap-3 mb-2 max-h-[400px] overflow-y-auto pr-2 no-scrollbar animate-in slide-in-from-bottom-8 fade-in duration-500 pointer-events-auto">
                        {recentCalls.length === 0 ? (
                            <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl text-[10px] text-zinc-400 font-bold uppercase tracking-widest text-center w-64">
                                No recent activity
                            </div>
                        ) : (
                            recentCalls.map((call) => (
                                <button
                                    key={call.id}
                                    onClick={() => {
                                        if (call.leadId) {
                                            fetchNextLead(call.leadId);
                                            setShowHistory(false);
                                        }
                                    }}
                                    className="w-64 text-left p-4 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl hover:bg-white/15 transition-all group relative overflow-hidden ring-1 ring-black/5"
                                >
                                    {/* Glass Highlight */}
                                    <div className="absolute inset-x-0 top-0 h-px bg-white/20" />

                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[11px] font-black text-white tracking-tight truncate pr-6 group-hover:text-teal-300 transition-colors">
                                            {call.leadName}
                                        </span>
                                        <span className="text-[9px] font-black text-white/30 font-mono shrink-0">
                                            {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border",
                                            call.status === 'COMPLETED'
                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                                        )}>
                                            {call.status}
                                        </div>
                                        {formatTime(call.duration || 0) !== "0:00" && (
                                            <div className="flex items-center gap-1.5 text-[9px] text-white/40 font-black uppercase tracking-tighter">
                                                <Clock className="h-2.5 w-2.5" />
                                                <span>{formatTime(call.duration || 0)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Icon */}
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                        <Phone className="h-3 w-3 text-teal-400 fill-current" />
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* Control Toggle */}
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-2xl pointer-events-auto",
                        showHistory
                            ? "bg-teal-600 text-white rotate-90 scale-110"
                            : "bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
                    )}
                >
                    <History className="h-5 w-5" />
                </button>
            </div>

        </div >
    );
}
