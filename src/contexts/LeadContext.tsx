import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useNotification } from "@/contexts/NotificationContext";
import { normalizeToE164 } from "@/lib/phone-utils";
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

interface LeadContextType {
    currentLead: Lead | null;
    loading: boolean;
    fetchNextLead: (forcedId?: string) => Promise<void>;
    fetchPreviousLead: () => Promise<void>;
    updateLeadStatus: (status: string, nextCallAt?: Date, userId?: string, notes?: string, contactData?: Partial<Lead>, customMessage?: string, timezone?: string, includeMeetLink?: boolean, includeCalendarLink?: boolean, meetingTitle?: string) => Promise<void>;
    events: CalendarEvent[];
    addEvent: (event: CalendarEvent) => void;
    stats: UserStats;
    setStats: React.Dispatch<React.SetStateAction<UserStats>>;
    campaignId: string | null;
    setCampaignId: (id: string | null) => void;
}

const LeadContext = createContext<LeadContextType | undefined>(undefined);

export function LeadProvider({ children }: { children: ReactNode }) {
    const [currentLead, setCurrentLead] = useState<Lead | null>(null);
    const [history, setHistory] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();

    const [campaignId, setCampaignId] = useState<string | null>(null);

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

    const fetchNextLead = async (forcedId?: string) => {
        setLoading(true);
        // Increment calls when fetching next (assuming a dial happened)
        // In a real app, we'd trigger this explicitly on "Dial", but for this flow it works
        setStats(prev => ({ ...prev, calls: prev.calls + 1 }));

        try {
            // Push current lead to history before checking new one, if it exists
            if (currentLead) {
                setHistory(prev => [...prev, currentLead]);
            }

            // If we have a current lead that wasn't dispositioned, skip it (release lock)
            // non-blocking fire-and-forget (or parallel) to speed up navigation
            if (currentLead && !forcedId) {
                console.log(`[LeadContext] Releasing lead ${currentLead.id} in background`);
                fetch(`/api/leads/${currentLead.id}/skip`, { method: "POST" }).catch(e => {
                    console.error("[LeadContext] Background release failed", e);
                });
            }

            try {
                let url = forcedId ? `/api/lead/next?id=${forcedId}` : "/api/lead/next";

                // Append campaignId if present and no forced ID (or even with forced ID if we want to validate? likely not needed for forced)
                if (campaignId && !forcedId) {
                    url += `${url.includes('?') ? '&' : '?'}campaignId=${campaignId}`;
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
    };

    const fetchPreviousLead = async () => {
        if (history.length === 0) return;
        setLoading(true);

        const previousLead = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1)); // Remove from history
        setCurrentLead(previousLead);
        setLoading(false);
    };

    const updateLeadStatus = async (status: string, nextCallAt?: Date, userId?: string, notes?: string, contactData?: Partial<Lead>, customMessage?: string, timezone?: string, includeMeetLink?: boolean, includeCalendarLink?: boolean, meetingTitle?: string) => {
        if (!currentLead) return;

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

            await fetch(`/api/leads/${currentLead.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, nextCallAt, userId, notes, contactData, customMessage, timezone, includeMeetLink, includeCalendarLink, meetingTitle }),
            });

            // Update local state if contact data was changed
            if (contactData) {
                setCurrentLead(prev => prev ? { ...prev, ...contactData } : null);
            }

        } catch (e) {
            console.error("Failed to update lead status", e);
            throw e; // Propagate error for UI feedback
        }
    };


    const addEvent = (event: CalendarEvent) => {
        setEvents(prev => [...prev, event]);
    };

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
            setCampaignId
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
