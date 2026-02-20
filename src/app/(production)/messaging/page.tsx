"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageThread } from "@/components/messaging/MessageThread";
import {
    Search, MessageSquare, Phone, Mic2, Plus, X,
    ArrowDownLeft, ArrowUpRight, Inbox, Loader2, Clock,
    Building2, PhoneCall
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { useNotification } from "@/contexts/NotificationContext";
import { Suspense } from "react";

type FilterType = 'all' | 'sms' | 'call' | 'voicemail';

interface InboxItem {
    id: string;
    type: 'sms' | 'call' | 'voicemail';
    contactName: string;
    contactPhone: string;
    companyName?: string;
    preview: string;
    timestamp: string;
    direction: string;
    duration?: number;
    recordingUrl?: string;
    conversationId?: string;
    leadId?: string;
    unreadCount?: number;
    avatarColor: string;
    outcome?: string;
    agentName?: string;
}

interface CrmContact {
    id: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    phoneNumber: string;
    email?: string;
}

export default function InboxPage() {
    return (
        <Suspense fallback={
            <div className="flex h-full items-center justify-center bg-zinc-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Inbox...</p>
                </div>
            </div>
        }>
            <InboxContent />
        </Suspense>
    );
}

function InboxContent() {
    const searchParams = useSearchParams();
    const { addNotification } = useNotification();

    const [items, setItems] = useState<InboxItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterType>(
        (searchParams.get('filter') as FilterType) || 'all'
    );
    const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // Compose state
    const [composing, setComposing] = useState(false);
    const [composeSearch, setComposeSearch] = useState("");
    const [crmResults, setCrmResults] = useState<CrmContact[]>([]);
    const [crmLoading, setCrmLoading] = useState(false);
    const [composeTarget, setComposeTarget] = useState<{ phone: string; leadId?: string; name: string } | null>(null);
    const composeDebounce = useRef<NodeJS.Timeout | null>(null);

    // Fetch unified inbox
    const fetchInbox = useCallback(async () => {
        try {
            const res = await fetch('/api/inbox');
            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            const data = await res.json();
            setItems(data);
        } catch (e) {
            console.error("Failed to fetch inbox", e);
            addNotification({ type: 'error', title: 'Inbox Error', message: 'Could not load inbox.' });
        } finally {
            setIsLoading(false);
        }
    }, [addNotification]);

    useEffect(() => {
        fetchInbox();
        const interval = setInterval(fetchInbox, 10000);
        return () => clearInterval(interval);
    }, [fetchInbox]);

    // Auto-select from URL param
    useEffect(() => {
        const leadId = searchParams.get('leadId');
        if (leadId && items.length > 0) {
            const match = items.find(i => i.leadId === leadId && i.type === 'sms');
            if (match) setSelectedItem(match);
        }
    }, [searchParams, items]);

    // CRM search for compose
    useEffect(() => {
        if (!composing || composeSearch.length < 2) {
            setCrmResults([]);
            return;
        }
        if (composeDebounce.current) clearTimeout(composeDebounce.current);
        composeDebounce.current = setTimeout(async () => {
            setCrmLoading(true);
            try {
                const res = await fetch(`/api/crm/contacts?q=${encodeURIComponent(composeSearch)}&status=ALL&pageSize=10`);
                if (res.ok) {
                    const data = await res.json();
                    setCrmResults(data.leads || []);
                }
            } catch (e) {
                console.error("CRM search failed", e);
            } finally {
                setCrmLoading(false);
            }
        }, 300);
        return () => { if (composeDebounce.current) clearTimeout(composeDebounce.current); };
    }, [composeSearch, composing]);

    // Filter items
    const filteredItems = items.filter(item => {
        if (activeFilter !== 'all' && item.type !== activeFilter) return false;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            return item.contactName.toLowerCase().includes(q)
                || item.contactPhone.includes(q)
                || (item.companyName || '').toLowerCase().includes(q)
                || item.preview.toLowerCase().includes(q);
        }
        return true;
    });

    const typeIcon = (type: string, direction: string) => {
        if (type === 'voicemail') return <Mic2 className="h-4 w-4 text-orange-500" />;
        if (type === 'call') return <Phone className="h-4 w-4 text-blue-500" />;
        return <MessageSquare className="h-4 w-4 text-teal-500" />;
    };

    const directionIcon = (direction: string) => {
        if (direction === 'INBOUND') return <ArrowDownLeft className="h-3 w-3 text-blue-400" />;
        return <ArrowUpRight className="h-3 w-3 text-zinc-400" />;
    };

    const relativeTime = (ts: string) => {
        const diff = Date.now() - new Date(ts).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'now';
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d`;
        return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const selectContact = (contact: CrmContact) => {
        setComposeTarget({
            phone: contact.phoneNumber,
            leadId: contact.id,
            name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.companyName || contact.phoneNumber
        });
        setComposing(false);
        setComposeSearch("");
        setCrmResults([]);
    };

    const selectRawNumber = () => {
        if (!composeSearch.trim()) return;
        setComposeTarget({ phone: composeSearch.trim(), name: composeSearch.trim() });
        setComposing(false);
        setComposeSearch("");
        setCrmResults([]);
    };

    const filters: { key: FilterType; label: string; icon: React.ReactNode }[] = [
        { key: 'all', label: 'All', icon: <Inbox className="h-3.5 w-3.5" /> },
        { key: 'sms', label: 'Texts', icon: <MessageSquare className="h-3.5 w-3.5" /> },
        { key: 'call', label: 'Calls', icon: <Phone className="h-3.5 w-3.5" /> },
        { key: 'voicemail', label: 'Voicemail', icon: <Mic2 className="h-3.5 w-3.5" /> },
    ];

    return (
        <div className="flex h-full bg-zinc-50 font-sans text-zinc-900 overflow-hidden">
            {/* Left Sidebar */}
            <div className={cn(
                "w-full sm:w-[380px] bg-white border-r border-zinc-200 flex flex-col z-10 shadow-[2px_0_20px_-10px_rgba(0,0,0,0.05)]",
                (selectedItem || composeTarget) && "hidden sm:flex"
            )}>
                {/* Header + Compose */}
                <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between shrink-0">
                    <h1 className="text-lg font-black text-zinc-900 tracking-tight">Inbox</h1>
                    <button
                        onClick={() => { setComposing(!composing); setComposeTarget(null); setSelectedItem(null); }}
                        className={cn(
                            "p-2 rounded-xl transition-all",
                            composing
                                ? "bg-zinc-900 text-white"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        )}
                    >
                        {composing ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </button>
                </div>

                {/* Compose Search */}
                {composing && (
                    <div className="p-3 border-b border-zinc-100 bg-zinc-50">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">New Message</p>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search contacts or type a number..."
                                value={composeSearch}
                                onChange={(e) => setComposeSearch(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') selectRawNumber(); }}
                                autoFocus
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                            />
                        </div>
                        {crmLoading && (
                            <div className="flex items-center gap-2 mt-2 px-1">
                                <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                                <span className="text-xs text-zinc-400">Searching CRM...</span>
                            </div>
                        )}
                        {crmResults.length > 0 && (
                            <div className="mt-2 border border-zinc-200 rounded-xl overflow-hidden bg-white max-h-60 overflow-y-auto">
                                {crmResults.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => selectContact(c)}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 transition-colors text-left border-b border-zinc-50 last:border-0"
                                    >
                                        <div className="h-8 w-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0">
                                            {(c.firstName || c.companyName || '?').charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-zinc-900 truncate">
                                                {`${c.firstName || ''} ${c.lastName || ''}`.trim() || c.companyName || 'Unknown'}
                                            </div>
                                            <div className="text-xs text-zinc-400 flex items-center gap-2">
                                                <span>{c.phoneNumber}</span>
                                                {c.companyName && <span>· {c.companyName}</span>}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        {composeSearch.length >= 2 && !crmLoading && crmResults.length === 0 && (
                            <button
                                onClick={selectRawNumber}
                                className="mt-2 w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-left hover:bg-zinc-50 transition-colors"
                            >
                                <div className="text-sm font-semibold text-zinc-700">Send to "{composeSearch}"</div>
                                <div className="text-xs text-zinc-400">No CRM match — send as raw number</div>
                            </button>
                        )}
                    </div>
                )}

                {/* Filter Tabs */}
                {!composing && (
                    <div className="px-3 py-2 border-b border-zinc-100 flex gap-1 shrink-0">
                        {filters.map(f => (
                            <button
                                key={f.key}
                                onClick={() => setActiveFilter(f.key)}
                                className={cn(
                                    "flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5",
                                    activeFilter === f.key
                                        ? "bg-zinc-900 text-white shadow-sm"
                                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                )}
                            >
                                {f.icon}
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Search */}
                {!composing && (
                    <div className="p-3 border-b border-zinc-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search inbox..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-300 transition-all"
                            />
                        </div>
                    </div>
                )}

                {/* Item List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                            <Inbox className="h-8 w-8 mb-3 opacity-30" />
                            <p className="text-xs font-bold uppercase tracking-wider">
                                {searchTerm ? 'No matches' : 'No items'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-50">
                            {filteredItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setSelectedItem(item);
                                        setComposeTarget(null);
                                        setComposing(false);
                                        // Mark as read if SMS with unread count
                                        if (item.type === 'sms' && item.conversationId && item.unreadCount && item.unreadCount > 0) {
                                            fetch(`/api/conversations/${item.conversationId}/read`, { method: 'POST' }).catch(() => {});
                                            // Clear badge locally
                                            setItems(prev => prev.map(i => i.id === item.id ? { ...i, unreadCount: 0 } : i));
                                        }
                                    }}
                                    className={cn(
                                        "w-full p-3.5 flex gap-3 transition-all text-left group relative",
                                        selectedItem?.id === item.id ? "bg-zinc-50" : "hover:bg-zinc-50/50"
                                    )}
                                >
                                    {selectedItem?.id === item.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900 rounded-r-md" />
                                    )}

                                    <div className={cn(
                                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm shadow-sm",
                                        item.avatarColor
                                    )}>
                                        {item.contactName.charAt(0).toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {directionIcon(item.direction)}
                                                <span className={cn(
                                                    "text-sm truncate",
                                                    selectedItem?.id === item.id ? "font-bold" : "font-semibold text-zinc-700"
                                                )}>
                                                    {item.contactName}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                {typeIcon(item.type, item.direction)}
                                                <span className="text-[10px] font-medium text-zinc-400">
                                                    {relativeTime(item.timestamp)}
                                                </span>
                                            </div>
                                        </div>
                                        {item.companyName && (
                                            <div className="text-[10px] font-medium text-zinc-400 truncate mb-0.5 flex items-center gap-1">
                                                <Building2 className="h-2.5 w-2.5 shrink-0" />
                                                {item.companyName}
                                            </div>
                                        )}
                                        <p className={cn(
                                            "text-xs truncate leading-relaxed",
                                            item.unreadCount && item.unreadCount > 0 ? "text-zinc-900 font-medium" : "text-zinc-500"
                                        )}>
                                            {item.preview}
                                        </p>
                                    </div>

                                    {item.unreadCount && item.unreadCount > 0 && (
                                        <div className="absolute right-3 bottom-3 h-5 w-5 rounded-full bg-teal-600 flex items-center justify-center shadow-sm">
                                            <span className="text-[10px] font-bold text-white">{item.unreadCount}</span>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Pane — Detail View */}
            <div className={cn(
                "flex-1 flex flex-col bg-zinc-50 h-full relative",
                !selectedItem && !composeTarget && "hidden sm:flex"
            )}>
                {/* SMS Detail → MessageThread */}
                {(selectedItem?.type === 'sms' || composeTarget) && (
                    <>
                        <div className="h-[64px] px-5 flex items-center justify-between border-b border-zinc-200 bg-white shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { setSelectedItem(null); setComposeTarget(null); }}
                                    className="sm:hidden p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                                <div className={cn(
                                    "h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm",
                                    selectedItem?.avatarColor || "bg-teal-100 text-teal-700"
                                )}>
                                    {(composeTarget?.name || selectedItem?.contactName || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-zinc-900">
                                        {composeTarget?.name || selectedItem?.contactName}
                                    </h2>
                                    <span className="text-[10px] font-medium text-zinc-400">
                                        {composeTarget?.phone || selectedItem?.contactPhone}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <MessageThread
                                conversationId={selectedItem?.conversationId}
                                leadId={composeTarget?.leadId || selectedItem?.leadId}
                                participantName={composeTarget?.name || selectedItem?.contactName}
                                onMessageSent={() => fetchInbox()}
                            />
                        </div>
                    </>
                )}

                {/* Call / Voicemail Detail */}
                {selectedItem && (selectedItem.type === 'call' || selectedItem.type === 'voicemail') && !composeTarget && (
                    <div className="flex-1 flex flex-col">
                        <div className="h-[64px] px-5 flex items-center border-b border-zinc-200 bg-white shadow-sm z-10">
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="sm:hidden p-1.5 rounded-lg hover:bg-zinc-100 transition-colors mr-3"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm",
                                    selectedItem.avatarColor
                                )}>
                                    {selectedItem.contactName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-zinc-900">{selectedItem.contactName}</h2>
                                    <span className="text-[10px] font-medium text-zinc-400">{selectedItem.contactPhone}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="w-full max-w-md space-y-6">
                                {/* Type Badge */}
                                <div className="flex items-center justify-center gap-3">
                                    <div className={cn(
                                        "h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg",
                                        selectedItem.type === 'voicemail'
                                            ? "bg-orange-100 text-orange-600"
                                            : "bg-blue-100 text-blue-600"
                                    )}>
                                        {selectedItem.type === 'voicemail'
                                            ? <Mic2 className="h-8 w-8" />
                                            : <Phone className="h-8 w-8" />}
                                    </div>
                                </div>

                                <div className="text-center">
                                    <h3 className="text-xl font-black text-zinc-900">{selectedItem.contactName}</h3>
                                    {selectedItem.companyName && (
                                        <p className="text-sm text-zinc-500 mt-1">{selectedItem.companyName}</p>
                                    )}
                                    <p className="text-xs text-zinc-400 mt-1">{selectedItem.contactPhone}</p>
                                </div>

                                {/* Details Card */}
                                <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Type</span>
                                        <span className={cn(
                                            "text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg",
                                            selectedItem.type === 'voicemail'
                                                ? "bg-orange-50 text-orange-600"
                                                : "bg-blue-50 text-blue-600"
                                        )}>
                                            {selectedItem.type === 'voicemail' ? 'Voicemail' : 'Phone Call'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Direction</span>
                                        <div className="flex items-center gap-1.5">
                                            {directionIcon(selectedItem.direction)}
                                            <span className="text-sm font-semibold text-zinc-700">{selectedItem.direction}</span>
                                        </div>
                                    </div>
                                    {selectedItem.outcome && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Outcome</span>
                                            <span className="text-sm font-semibold text-zinc-700">{selectedItem.outcome}</span>
                                        </div>
                                    )}
                                    {selectedItem.duration !== undefined && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Duration</span>
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                                                <span className="text-sm font-semibold text-zinc-700">{formatDuration(selectedItem.duration)}</span>
                                            </div>
                                        </div>
                                    )}
                                    {selectedItem.agentName && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Agent</span>
                                            <span className="text-sm font-semibold text-zinc-700">{selectedItem.agentName}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Time</span>
                                        <span className="text-sm font-semibold text-zinc-700">
                                            {new Date(selectedItem.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>

                                {/* Audio Player */}
                                {selectedItem.recordingUrl && (
                                    <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
                                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                                            {selectedItem.type === 'voicemail' ? 'Voicemail Recording' : 'Call Recording'}
                                        </p>
                                        <audio controls className="w-full h-10">
                                            <source src={selectedItem.recordingUrl} type="audio/mpeg" />
                                        </audio>
                                    </div>
                                )}

                                {/* Actions */}
                                {selectedItem.leadId && (
                                    <div className="flex gap-3">
                                        <a
                                            href={`/dialer?leadId=${selectedItem.leadId}`}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
                                        >
                                            <PhoneCall className="h-4 w-4" />
                                            Call Back
                                        </a>
                                        <button
                                            onClick={() => {
                                                setComposeTarget({
                                                    phone: selectedItem.contactPhone,
                                                    leadId: selectedItem.leadId,
                                                    name: selectedItem.contactName
                                                });
                                                setSelectedItem(null);
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
                                        >
                                            <MessageSquare className="h-4 w-4" />
                                            Text
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!selectedItem && !composeTarget && (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400/80 p-8">
                        <div className="w-24 h-24 rounded-3xl bg-white border border-zinc-200 flex items-center justify-center mb-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                            <Inbox className="h-10 w-10 text-zinc-300 stroke-[1.5]" />
                        </div>
                        <h3 className="text-zinc-900 font-bold text-lg mb-2">Unified Inbox</h3>
                        <p className="text-zinc-500 text-sm max-w-xs text-center leading-relaxed">
                            Select a conversation, call, or voicemail — or compose a new message.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
