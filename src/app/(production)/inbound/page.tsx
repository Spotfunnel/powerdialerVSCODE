"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InboundPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/messaging?filter=voicemail");
    }, [router]);

    return (
        <div className="flex h-full items-center justify-center bg-zinc-50">
            <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Redirecting to Inbox...</p>
            </div>
        </div>
    );
}
