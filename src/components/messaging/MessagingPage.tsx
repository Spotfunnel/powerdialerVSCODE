"use client";

import { useState } from "react";
import { ConversationList } from "./ConversationList";
import { ChatInterface } from "./ChatInterface";

export function MessagingPage() {
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    return (
        <div className="flex h-screen bg-zinc-50 border-t border-zinc-200">
            {/* Left Pane: Conversation List */}
            <div className="w-80 border-r border-zinc-200 bg-white flex flex-col">
                <ConversationList
                    selectedId={selectedConversationId}
                    onSelect={setSelectedConversationId}
                />
            </div>

            {/* Right Pane: Chat Interface */}
            <div className="flex-1 flex flex-col bg-zinc-50">
                {selectedConversationId ? (
                    <ChatInterface conversationId={selectedConversationId} />
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
                        Select a conversation to start messaging
                    </div>
                )}
            </div>
        </div>
    );
}
