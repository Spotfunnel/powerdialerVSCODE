import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useNotification } from "@/contexts/NotificationContext";
import { normalizeToE164 } from "@/lib/phone-utils";
import { extractDispatch } from "@/lib/disposition-response";
import { Lead } from "@/types/dialer";


import { REVENUE_PER_DEMO } from "@/lib/constants";

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    type: 'meeting' | 'callback';
}

export interface UserStats {
    calls: number;
    demos: number;
    revenue: number;
}

export interface DispositionDispatch {
    calendar?: 'sent' | 'failed' | 'skipped';
    calendarError?: string;
    sms?: 'sent' | 'failed' | 'skipped' | 'blocked-landline';
    smsError?: string;
}

interface LeadContextType {
    currentLead: Lead | null;
    loading: boolean;
    fetchNextLead: (forcedId?: string) => Promise<void>;
    fetchPreviousLead: () => Promise<void>;
    updateLeadStatus: (status: string, nextCallAt?: Date, userId?: string, notes?: string, contactData?: Partial<Lead>, customMessage?: string, timezone?: string, includeMeetLink?: boolean, includeCalendarLink?: boolean, meetingTitle?: string) => Promise<DispositionDispatch | null>;
    events: CalendarEvent[];
    addEvent: (event: CalendarEvent) => void;
    stats: UserStats;
    setStats: React.Dispatch<React.SetStateAction<UserStats>>;
    campaignId: string | null;
    setCampaignId: (id: string | null) => void;
    selectedStates: string[];
    setSelectedStates: (states: string[]) => void;
}

const LeadContext = createContext<LeadContextType | undefined>(undefined);

export function LeadProvider({ children }: { children: ReactNode }) {
    const [currentLead, setCurrentLead] = useState<Lead | null>(null);
    const [history, setHistory] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();

    const [campaignId, setCampaignId] = useState<string | null>(null);
    const [selectedStates, setSelectedStates] = useState<string[]>([]);

    // Refs to avoid stale closures in useCallback — always read fresh values
    const currentLeadRef = useRef(currentLead);
    currentLeadRef.current = currentLead;
    const campaignIdRef = useRef(campaignId);
    campaignIdRef.current = campaignId;
    const selectedStatesRef = useRef(selectedStates);
    selectedStatesRef.current = selectedStates;

    // Shared Simulation State
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [stats, setStats] = useState<UserStats>({ calls: 0, demos: 0, revenue: 0 });

    // Fetch initial stats
    useEffect(() => {
        fetch('/api/user/stats')
            .then(res => res.json())
            .then(data => {
                if (data && typeof data.calls === 'number') {
                    setStats(data);
                }
            })
            .catch(err => console.error("Failed to fetch user stats", err));
    }, []);

    // Helper to simulate network delay
    // const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // PREFETCH: as soon as a lead is shown, we acquire+lock the NEXT one in
    // the background. When the rep dispositions, we swap synchronously to
    // the prefetched lead — no /api/lead/next round-trip in the critical path.
    // Lock expires server-side after 30min, so leaving the tab idle has no
    // long-term cost. Filter changes invalidate the prefetch and release it.
    const prefetchedRef = useRef<{ lead: Lead; campaignId: string | null; states: string[] } | null>(null);
    const prefetchInFlightRef = useRef<Promise<void> | null>(null);

    const doPrefetch = useCallback(() => {
        if (prefetchInFlightRef.current) return;
        const lead = currentLeadRef.current;
        if (!lead) return;
        const campaign = campaignIdRef.current;
        const states = [...selectedStatesRef.current];

        const run = async () => {
            try {
                const qs: string[] = [];
                if (campaign) qs.push(`campaignId=${encodeURIComponent(campaign)}`);
                if (states.length > 0) qs.push(`states=${states.join(",")}`);
                qs.push(`skipId=${lead.id}`);
                const url = `/api/lead/next?${qs.join("&")}`;
                const res = await fetch(url, { method: "GET" });
                if (!res.ok) return;
                const data = await res.json();
                prefetchedRef.current = { lead: data, campaignId: campaign, states };
                console.log(`[LeadContext] Prefetched next: ${data.id} (${data.companyName})`);
            } catch (e) {
                console.warn("[LeadContext] Prefetch failed", e);
            } finally {
                prefetchInFlightRef.current = null;
            }
        };
        prefetchInFlightRef.current = run();
    }, []);

    const fetchNextLead = useCallback(async (forcedId?: string) => {
        const lead = currentLeadRef.current;
        const campaign = campaignIdRef.current;
        const states = selectedStatesRef.current;

        // Fast path: prefetched lead matches current filters → swap instantly,
        // no spinner, no network in the critical path.
        if (!forcedId) {
            if (!prefetchedRef.current && prefetchInFlightRef.current) {
                // A prefetch is in flight — wait briefly so we can use it.
                await prefetchInFlightRef.current;
            }
            const cached = prefetchedRef.current;
            const sameFilters = cached
                && cached.campaignId === campaign
                && JSON.stringify(cached.states) === JSON.stringify(states);
            if (cached && sameFilters) {
                prefetchedRef.current = null;
                if (lead) {
                    setHistory(prev => [...prev.slice(-29), lead]);
                    fetch(`/api/leads/${lead.id}/skip`, { method: "POST" }).catch(() => {});
                }
                console.log(`[LeadContext] Instant swap to prefetched: ${cached.lead.id} (${cached.lead.companyName})`);
                setCurrentLead(cached.lead);
                return;
            }
        }

        setLoading(true);

        try {
            // Push current lead to history (cap at 30 to prevent unbounded growth)
            if (lead) {
                setHistory(prev => [...prev.slice(-29), lead]);
            }

            // Release current lead's lock — fire-and-forget. We don't pay
            // an extra round-trip before /next; the next-lead query passes
            // skipId in the URL so it can't return the same lead even if
            // the lock is still held briefly when /next reaches the server.
            if (lead && !forcedId) {
                console.log(`[LeadContext] Releasing lead ${lead.id}`);
                fetch(`/api/leads/${lead.id}/skip`, { method: "POST" })
                    .catch(e => console.error("[LeadContext] Release failed", e));
            }

            try {
                let url = forcedId ? `/api/lead/next?id=${forcedId}` : "/api/lead/next";

                if (campaign && !forcedId) {
                    url += `${url.includes('?') ? '&' : '?'}campaignId=${campaign}`;
                }

                if (states.length > 0 && !forcedId) {
                    url += `${url.includes('?') ? '&' : '?'}states=${states.join(',')}`;
                }

                if (lead && !forcedId) {
                    url += `${url.includes('?') ? '&' : '?'}skipId=${lead.id}`;
                }

                console.log(`[LeadContext] Fetching lead via: ${url}`);

                const res = await fetch(url, { method: "GET" });

                if (res.ok) {
                    const data = await res.json();
                    console.log(`[LeadContext] Next lead acquired: ${data.id} (${data.companyName})`);
                    setCurrentLead(data);
                } else {
                    const err = await res.json().catch(() => ({ error: 'Unknown API error' }));
                    console.error(`[LeadContext] Failed to acquire lead: ${res.status}`, err);
                    setCurrentLead(null);
                }
            } catch (err: any) {
                console.error("[LeadContext] Fetch operation failed", err);
                throw err;
            }

        } catch (e) {
            console.error("Failed to fetch lead", e);
        } finally {
            setLoading(false);
        }
    }, []); // Stable reference — reads fresh values via refs

    const fetchPreviousLead = async () => {
        if (history.length === 0) return;
        setLoading(true);

        const previousLead = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1)); // Remove from history
        setCurrentLead(previousLead);
        setLoading(false);
    };

    const updateLeadStatus = useCallback(async (status: string, nextCallAt?: Date, userId?: string, notes?: string, contactData?: Partial<Lead>, customMessage?: string, timezone?: string, includeMeetLink?: boolean, includeCalendarLink?: boolean, meetingTitle?: string) => {
        const lead = currentLeadRef.current;
        if (!lead) return null;

        // Track Demos
        if (status === 'BOOKED') {
            setStats(prev => ({
                ...prev,
                demos: prev.demos + 1,
                revenue: prev.revenue + REVENUE_PER_DEMO
            }));
        }

        try {
            if (contactData?.phoneNumber) {
                contactData.phoneNumber = normalizeToE164(contactData.phoneNumber);
            }

            const res = await fetch(`/api/leads/${lead.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, nextCallAt, userId, notes, contactData, customMessage, timezone, includeMeetLink, includeCalendarLink, meetingTitle }),
            });

            const result = await res.json().catch(() => ({}));

            // Fail loudly on a non-2xx: fetch does NOT reject on 4xx/5xx, so a
            // failed disposition (atomic-tx error, "Lead not found", DB drop)
            // would otherwise be swallowed and the rep told it succeeded — the
            // disposition silently lost, a false "booked" banner shown. Throwing
            // here routes to DispositionPanel's handleDispositionFailure.
            const dispatch = extractDispatch<DispositionDispatch>(res.ok, res.status, result);

            if (contactData) {
                setCurrentLead(prev => prev ? { ...prev, ...contactData } : null);
            }

            return dispatch;

        } catch (e) {
            console.error("Failed to update lead status", e);
            throw e;
        }
    }, []);


    const addEvent = (event: CalendarEvent) => {
        setEvents(prev => [...prev, event]);
    };

    // Drive the prefetch: whenever currentLead settles (or filters change),
    // invalidate stale prefetch and kick off a fresh one.
    useEffect(() => {
        if (!currentLead?.id) return;
        const cached = prefetchedRef.current;
        const sameFilters = cached
            && cached.campaignId === campaignId
            && JSON.stringify(cached.states) === JSON.stringify(selectedStates);
        if (cached && !sameFilters) {
            // Stale prefetch (filters changed) — release its lock so other reps can pick it up.
            fetch(`/api/leads/${cached.lead.id}/skip`, { method: "POST" }).catch(() => {});
            prefetchedRef.current = null;
        }
        if (!prefetchedRef.current) {
            doPrefetch();
        }
    }, [currentLead?.id, campaignId, selectedStates, doPrefetch]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input or contentEditable
            const target = e.target as HTMLElement;
            if (
                ['INPUT', 'TEXTAREA'].includes(target.tagName) ||
                target.isContentEditable
            ) return;

            // Ignore modifiers (Cmd/Ctrl/Alt/Shift)
            if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

            // Use code for physical key position (simpler cross-layout/cross-browser)
            // Also adding debug log to see if it's firing at all
            // console.log("Key pressed:", e.code, e.key); 

            switch (e.code) {
                case 'KeyN':
                    e.preventDefault();
                    fetchNextLead();
                    break;
                case 'KeyP':
                    e.preventDefault();
                    fetchPreviousLead();
                    break;
                // case 'd': moved to CallInterface

            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentLead, history]); // Re-bind when state changes to capture latest

    const leadIdParam = searchParams.get("leadId");

    // Initial fetch (queue or forced)
    // Initial fetch (queue or forced)
    useEffect(() => {
        // If we have a forced ID, always fetch it, regardless of current state
        if (leadIdParam) {
            // console.log("LeadContext: Detected forced leadId param via URL:", leadIdParam);
            // Pass the forced ID to fetchNextLead to load it specifically
            fetchNextLead(leadIdParam);
        }
        // Only fetch default next lead if we are MOUNTING and have no lead. 
        // This prevents automatic overwrites if the context rehydrates.
        else if (!currentLead) {
            // console.log("LeadContext: No lead active, fetching next queue item.");
            fetchNextLead();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leadIdParam]); // Only re-run if the URL param actually changes

    // Auto-fetch next lead when campaign changes
    const isInitialCampaignRender = useRef(true);
    useEffect(() => {
        if (isInitialCampaignRender.current) {
            isInitialCampaignRender.current = false;
            return;
        }
        fetchNextLead();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaignId]);

    // Auto-fetch next lead when state filters change
    const isInitialStatesRender = useRef(true);
    useEffect(() => {
        if (isInitialStatesRender.current) {
            isInitialStatesRender.current = false;
            return;
        }
        fetchNextLead();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStates]);

    return (
        <LeadContext.Provider value={{
            currentLead,
            loading,
            fetchNextLead,
            fetchPreviousLead,
            updateLeadStatus,
            events,
            addEvent,
            stats,
            setStats,
            campaignId,
            setCampaignId,
            selectedStates,
            setSelectedStates
        }}>
            {children}
        </LeadContext.Provider>
    );
}

export const useLead = () => {
    const context = useContext(LeadContext);
    if (!context) throw new Error("useLead must be used within LeadProvider");
    return context;
}
