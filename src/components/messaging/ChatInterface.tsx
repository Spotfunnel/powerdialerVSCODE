"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Phone, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    body: string;
    direction: "INBOUND" | "OUTBOUND";
    createdAt: string;
    status: string;
    fromNumber: string;
}

interface ChatInterfaceProps {
    conversationId: string;
}

export function ChatInterface({ conversationId }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchMessages = async () => {
        if (!conversationId) return;
        try {
            const res = await fetch(`/api/conversations/${conversationId}/messages`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [conversationId]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    const handleSend = async () => {
        if (!input.trim()) return;
        setSending(true);
        try {
            const res = await fetch(`/api/conversations/${conversationId}/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: input })
            });
            if (res.ok) {
                setInput("");
                fetchMessages();
            }
        } catch (err) {
            console.error("Send failed", err);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="h-16 border-b border-zinc-200 flex items-center justify-between px-6 bg-white">
                <div>
                    {/* Can fetch conversation details to show name here */}
                    <h2 className="font-semibold text-zinc-900">Conversation</h2>
                    <p className="text-xs text-zinc-500">via SMS</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/50">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            "max-w-[70%] p-3 rounded-2xl text-sm font-medium",
                            msg.direction === 'OUTBOUND'
                                ? "ml-auto bg-emerald-600 text-white rounded-tr-sm"
                                : "mr-auto bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm shadow-sm"
                        )}
                    >
                        <p>{msg.body}</p>
                        <div className={cn(
                            "text-[10px] mt-1 text-right opacity-70",
                            msg.direction === 'OUTBOUND' ? "text-emerald-100" : "text-zinc-400"
                        )}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {msg.direction === 'OUTBOUND' && ` • ${msg.status.toLowerCase()}`}
                        </div>
                    </div>
                ))}
                <div ref={scrollRef} />
            </div>

            {/* Composer */}
            <div className="p-4 border-t border-zinc-200 bg-white">
                <div className="relative flex items-center gap-2">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        className="flex-1 bg-zinc-100 border-none rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="Type a message..."
                        disabled={sending}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || sending}
                        className={cn(
                            "p-3 rounded-full transition-colors",
                            input.trim()
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-zinc-100 text-zinc-400"
                        )}
                    >
                        <Send className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
