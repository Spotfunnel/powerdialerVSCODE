"use client";

import { useEffect, useState, useRef } from "react";
import { Send, Loader2, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotification } from "@/contexts/NotificationContext";

interface Message {
    id: string;
    body: string;
    direction: "INBOUND" | "OUTBOUND";
    createdAt: string;
    status: string;
    user?: { name: string };
}

interface MessageThreadProps {
    conversationId?: string;
    leadId?: string; // Fallback if no conversationId known yet
    participantName?: string;
    onMessageSent?: () => void;
    lastCalledNumber?: string; // Optional: prepopulate from parent
}

interface TwilioNumber {
    id: string;
    phoneNumber: string;
    friendlyName?: string;
}

export function MessageThread({ conversationId, leadId, participantName, onMessageSent, lastCalledNumber }: MessageThreadProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [inputValue, setInputValue] = useState("");

    const [availableNumbers, setAvailableNumbers] = useState<TwilioNumber[]>([]);
    const [selectedNumber, setSelectedNumber] = useState<string>("");

    const { addNotification } = useNotification();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Undo Logic State
    const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);
    const [pendingBody, setPendingBody] = useState("");
    const [countdown, setCountdown] = useState(0);

    const fetchMessages = async () => {
        if (!conversationId && !leadId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (conversationId) params.append("conversationId", conversationId);
            if (leadId) params.append("leadId", leadId);

            const res = await fetch(`/api/messaging/messages?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchNumbers = async () => {
        try {
            const res = await fetch("/api/messaging/numbers");
            if (res.ok) {
                const data = await res.json();
                setAvailableNumbers(data);

                // If we have a last called number, prioritize it
                if (lastCalledNumber) {
                    setSelectedNumber(lastCalledNumber);
                } else if (data.length > 0) {
                    setSelectedNumber(data[0].phoneNumber);
                }
            }
        } catch (e) {
            console.error("Numbers fetch fail", e);
        }
    };

    useEffect(() => {
        fetchMessages();
        fetchNumbers();
        // Simple polling for now
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [conversationId, leadId, lastCalledNumber]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Countdown Effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (countdown > 0 && undoTimer) {
            interval = setInterval(() => {
                setCountdown(prev => Math.max(0, prev - 1));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [countdown, undoTimer]);

    // Initial Send Click
    const handleSendClick = () => {
        if (!inputValue.trim() || !leadId) return;

        const bodyToSend = inputValue;
        setPendingBody(bodyToSend);
        setInputValue(""); // Clear input
        setCountdown(5); // Start at 5 seconds
        setSending(true);

        const timer = setTimeout(() => {
            executeSend(bodyToSend);
        }, 5000);

        setUndoTimer(timer);
    };

    // Actual API Call
    const executeSend = async (body: string) => {
        setUndoTimer(null);
        setCountdown(0);

        try {
            const res = await fetch("/api/messaging/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    leadId,
                    body,
                    from: selectedNumber // Pass the selected sender number
                })
            });

            if (res.ok) {
                fetchMessages();
                onMessageSent?.();
            } else {
                addNotification({
                    type: 'error',
                    title: 'Delivery Failed',
                    message: 'Could not send SMS to lead.'
                });
                setInputValue(body); // Restore on fail
            }
        } catch (e) {
            console.error(e);
            setInputValue(body);
        } finally {
            setSending(false);
            setPendingBody("");
        }
    };

    // Undo Click
    const handleUndo = () => {
        if (undoTimer) {
            clearTimeout(undoTimer);
            setUndoTimer(null);
        }
        setInputValue(pendingBody); // Restore text to input
        setPendingBody("");
        setSending(false);
        setCountdown(0);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {loading && messages.length === 0 && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                )}

                {messages.length === 0 && !loading && (
                    <div className="text-center py-10 text-slate-400 text-sm">
                        No messages yet. Start the conversation!
                    </div>
                )}

                {messages.map((msg) => {
                    const isMe = msg.direction === "OUTBOUND";
                    return (
                        <div key={msg.id} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
                            <div className={cn(
                                "max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                                isMe
                                    ? "bg-teal-600 text-white rounded-br-none"
                                    : "bg-white text-slate-700 border border-slate-200 rounded-bl-none"
                            )}>
                                <p>{msg.body}</p>
                                <div className={cn("text-[10px] mt-1 opacity-70 flex items-center gap-2", isMe ? "justify-end text-teal-100" : "text-slate-400")}>
                                    {msg.user && <span>{msg.user.name}</span>}
                                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Undo Notification / Buffer State */}
                {undoTimer && (
                    <div className="flex w-full justify-end animate-in fade-in slide-in-from-bottom-2">
                        <div className="max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm bg-teal-50 border border-teal-100 text-teal-800 rounded-br-none opacity-90 backdrop-blur-sm">
                            <p>{pendingBody}</p>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-teal-200/50">
                                <span className="text-[10px] font-bold uppercase tracking-wide opacity-70 flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Sending in {countdown}...
                                </span>
                                <button
                                    onClick={handleUndo}
                                    className="text-[10px] font-black uppercase tracking-wider text-red-600 hover:text-red-700 hover:underline px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                >
                                    Undo
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-200">
                <div className="flex items-end gap-2">
                    <textarea
                        className="flex-1 min-h-[44px] max-h-32 mb-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none text-sm"
                        placeholder="Type a message..."
                        rows={1}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendClick();
                            }
                        }}
                    />
                    <button
                        onClick={handleSendClick}
                        disabled={sending || (!inputValue.trim() && !undoTimer)}
                        className="h-11 w-11 mb-1 flex items-center justify-center rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm active:scale-95"
                    >
                        {sending && !undoTimer ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                </div>

                {/* Sender Number Selector (Sleek Bottom Bar) */}
                {availableNumbers.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sending From:</span>
                        <select
                            value={selectedNumber}
                            onChange={(e) => setSelectedNumber(e.target.value)}
                            className="text-[10px] font-bold text-teal-700 bg-transparent border-none focus:ring-0 cursor-pointer hover:bg-slate-50 rounded pl-1"
                        >
                            {availableNumbers.map(n => (
                                <option key={n.id} value={n.phoneNumber}>
                                    {n.phoneNumber}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}
