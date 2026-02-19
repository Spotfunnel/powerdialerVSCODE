"use client";

import { useState, useEffect } from "react";
import { Search, MessageSquare, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
    id: string;
    contactPhone: string;
    contact?: {
        firstName: string | null;
        lastName: string | null;
        companyName: string | null;
    };
    lastMessageAt: string;
    unreadCount: number;
    messages: { body: string; createdAt: string }[];
}

export function ConversationList({ selectedId, onSelect }: { selectedId: string | null, onSelect: (id: string) => void }) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    const fetchConversations = async () => {
        setLoading(true);
        try {
            // Need to implement an API route for listing conversations
            // For now, let's assume /api/conversations exists or use a mock
            const res = await fetch("/api/conversations");
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
            }
        } catch (error) {
            console.error("Failed to load conversations", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 5000); // Poll
        return () => clearInterval(interval);
    }, []);

    const filtered = conversations.filter(c =>
        c.contactPhone.includes(search) ||
        c.contact?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        c.contact?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
        c.contact?.companyName?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-zinc-100">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                        className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Search messages..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {filtered.map(conv => {
                    const lastMsg = conv.messages[0]?.body || "No messages";
                    const isSelected = conv.id === selectedId;
                    const name = conv.contact ? `${conv.contact.firstName || ''} ${conv.contact.lastName || ''}`.trim() || conv.contact.companyName : conv.contactPhone;

                    return (
                        <div
                            key={conv.id}
                            onClick={() => onSelect(conv.id)}
                            className={cn(
                                "p-4 border-b border-zinc-50 cursor-pointer hover:bg-zinc-50 transition-colors",
                                isSelected && "bg-emerald-50/50 border-emerald-100"
                            )}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={cn("font-medium text-sm truncate", isSelected ? "text-emerald-900" : "text-zinc-900")}>
                                    {name || conv.contactPhone}
                                </span>
                                {conv.unreadCount > 0 && (
                                    <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                        {conv.unreadCount}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-zinc-500 truncate line-clamp-1">{lastMsg}</p>
                            <span className="text-[10px] text-zinc-400 mt-1 block">
                                {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}
