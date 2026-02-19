"use client";

import { useState, useEffect } from "react";
import { MessageThread } from "@/components/messaging/MessageThread";
import { Search, MessageSquare, Clock, User, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
    id: string;
    contactName: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
    contactId: string;
}

export default function MessagesPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchConversations = async () => {
        try {
            const res = await fetch("/api/messaging/conversations");
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 10000);
        return () => clearInterval(interval);
    }, []);

    const selectedConv = conversations.find(c => c.id === selectedId);

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 border-t border-slate-200">
            {/* Sidebar List */}
            <div className="w-[380px] flex flex-col bg-white border-r border-slate-200">
                <div className="p-4 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">Active Inbox</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            placeholder="Search messages..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading && (
                        <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
                    )}

                    {!loading && conversations.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            No active conversations
                        </div>
                    )}

                    {conversations.map((conv) => (
                        <button
                            key={conv.id}
                            onClick={() => setSelectedId(conv.id)}
                            className={cn(
                                "w-full p-4 flex items-start gap-3 border-b border-slate-50 hover:bg-slate-50 transition-colors text-left",
                                selectedId === conv.id && "bg-teal-50/50 hover:bg-teal-50/50 border-l-4 border-l-teal-500"
                            )}
                        >
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                                <User className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className={cn("font-semibold truncate", conv.unreadCount > 0 ? "text-slate-900" : "text-slate-700")}>
                                        {conv.contactName}
                                    </span>
                                    <span className="text-[10px] text-slate-400 flex-shrink-0">
                                        {new Date(conv.lastMessageAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className={cn("text-xs truncate", conv.unreadCount > 0 ? "font-medium text-slate-800" : "text-slate-500")}>
                                    {conv.lastMessage}
                                </p>
                            </div>
                            {conv.unreadCount > 0 && (
                                <div className="h-5 min-w-[20px] px-1.5 rounded-full bg-teal-600 text-[10px] font-bold text-white flex items-center justify-center">
                                    {conv.unreadCount}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-slate-50/50">
                {selectedId && selectedConv ? (
                    <>
                        <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-slate-900">{selectedConv.contactName}</h3>
                                <p className="text-xs text-slate-500">Active</p>
                            </div>
                            {/* <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
                                <CheckCircle2 className="h-5 w-5" />
                            </button> */}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <MessageThread
                                conversationId={selectedId}
                                leadId={selectedConv.contactId}
                                participantName={selectedConv.contactName}
                                onMessageSent={fetchConversations} // Refresh list on send
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <div className="bg-slate-100 p-6 rounded-full mb-4">
                            <MessageSquare className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-sm font-medium">Select a conversation to start messaging</p>
                    </div>
                )}
            </div>
        </div>
    );
}
