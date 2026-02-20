"use client";

import { useState, useEffect } from "react";
import { MessageThread } from "@/components/messaging/MessageThread";
import { Search, MessageSquare, User, Filter, Archive, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useNotification } from "@/contexts/NotificationContext";

import { Suspense } from "react";

export default function MessagesPage() {
    return (
        <Suspense fallback={
            <div className="flex h-full items-center justify-center bg-zinc-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Inbox...</p>
                </div>
            </div>
        }>
            <MessagesContent />
        </Suspense>
    );
}

function MessagesContent() {
    const searchParams = useSearchParams();
    const { addNotification } = useNotification();
    const router = useRouter();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [conversations, setConversations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'OPEN' | 'CLOSED'>('OPEN');

    const fetchConversations = async (status: string = activeTab) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/messaging/conversations?status=${status}`);
            if (!res.ok) {
                throw new Error(`Server returned ${res.status}`);
            }
            const data = await res.json();
            setConversations(data);

            // Auto-select based on content URL param
            const leadIdParam = searchParams.get('leadId');
            if (leadIdParam && status === 'OPEN') {
                const targetConv = data.find((c: any) => c.contactId === leadIdParam);
                if (targetConv) {
                    setSelectedId(targetConv.id);
                }
            }
        } catch (e) {
            console.error("Failed to fetch conversations", e);
            addNotification({
                type: 'error',
                title: 'Sync Error',
                message: 'Could not update your inbox.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConversations(activeTab);
    }, [activeTab, searchParams]); // Re-run on tab change or param change

    const handleTabChange = (status: 'OPEN' | 'CLOSED') => {
        if (status === activeTab) return;
        setSelectedId(null);
        setActiveTab(status); // triggers useEffect
    };

    const filteredConversations = conversations.filter(c =>
        c.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedConv = conversations.find(c => c.id === selectedId);

    return (
        <div className="flex h-full bg-zinc-50 font-sans text-zinc-900 overflow-hidden">
            {/* Sidebar - Hidden on mobile when conversation selected */}
            <div className={cn(
                "w-full sm:w-[380px] bg-white border-r border-zinc-200 flex flex-col z-10 shadow-[2px_0_20px_-10px_rgba(0,0,0,0.05)]",
                selectedId && "hidden sm:flex"
            )}>
                {/* Header with Tabs */}
                <div className="h-[72px] px-6 flex items-center justify-between border-b border-zinc-100 shrink-0 bg-white">
                    <div className="flex bg-zinc-100/80 p-1 rounded-xl w-full">
                        <button
                            onClick={() => handleTabChange('OPEN')}
                            className={cn(
                                "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                                activeTab === 'OPEN'
                                    ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                                    : "text-zinc-400 hover:text-zinc-600",
                                isLoading && "opacity-50 pointer-events-none"
                            )}
                        >
                            <MessageSquare className={cn("h-3.5 w-3.5", activeTab === 'OPEN' ? "text-teal-600 fill-teal-600/10" : "text-zinc-400")} />
                            Active
                        </button>
                        <button
                            onClick={() => handleTabChange('CLOSED')}
                            className={cn(
                                "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                                activeTab === 'CLOSED'
                                    ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                                    : "text-zinc-400 hover:text-zinc-600",
                                isLoading && "opacity-50 pointer-events-none"
                            )}
                        >
                            <Archive className={cn("h-3.5 w-3.5", activeTab === 'CLOSED' ? "text-orange-500 fill-orange-500/10" : "text-zinc-400")} />
                            Archived
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-zinc-100 bg-white">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-300 transition-all"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                    <div className="divide-y divide-zinc-50">
                        {filteredConversations.map((conv) => (
                            <button
                                key={conv.id}
                                onClick={() => setSelectedId(conv.id)}
                                className={cn(
                                    "w-full p-4 flex gap-4 transition-all text-left group relative",
                                    selectedId === conv.id
                                        ? "bg-zinc-50"
                                        : "hover:bg-zinc-50/50"
                                )}
                            >
                                {/* Selection Indicator */}
                                {selectedId === conv.id && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900 rounded-r-md" />
                                )}

                                <div className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm shadow-sm",
                                    conv.avatarColor
                                )}>
                                    {conv.contactName.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className={cn(
                                            "text-sm truncate",
                                            selectedId === conv.id ? "font-bold text-zinc-900" : "font-semibold text-zinc-700"
                                        )}>
                                            {conv.contactName}
                                        </span>
                                        <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
                                            {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className={cn(
                                        "text-xs truncate leading-relaxed",
                                        conv.unreadCount > 0 ? "text-zinc-900 font-medium" : "text-zinc-500"
                                    )}>
                                        {conv.lastMessage}
                                    </p>
                                </div>
                                {conv.unreadCount > 0 && (
                                    <div className="absolute right-4 bottom-4 h-5 w-5 rounded-full bg-teal-600 flex items-center justify-center shadow-sm shadow-teal-600/20">
                                        <span className="text-[10px] font-bold text-white">{conv.unreadCount}</span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={cn(
                "flex-1 flex flex-col bg-zinc-50 h-full relative",
                !selectedId && "hidden sm:flex"
            )}>
                {selectedConv ? (
                    <>
                        <div className="h-[72px] px-6 flex items-center justify-between border-b border-zinc-200 bg-white shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm",
                                    selectedConv.avatarColor
                                )}>
                                    {selectedConv.contactName.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-zinc-900">{selectedConv.contactName}</h2>
                                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 items-center animate-pulse" />
                                        Online
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden relative">
                            <MessageThread
                                conversationId={selectedId || undefined}
                                leadId={selectedConv.contactId}
                                participantName={selectedConv.contactName}
                                onMessageSent={() => fetchConversations(activeTab)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400/80 p-8">
                        <div className="w-24 h-24 rounded-3xl bg-white border border-zinc-200 flex items-center justify-center mb-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] animate-in zoom-in-50 duration-500">
                            <MessageSquare className="h-10 w-10 text-zinc-300 stroke-[1.5]" />
                        </div>
                        <h3 className="text-zinc-900 font-bold text-lg mb-2">No Conversation Selected</h3>
                        <p className="text-zinc-500 text-sm max-w-xs text-center leading-relaxed">Select a conversation from the active inbox to view message history and reply.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
