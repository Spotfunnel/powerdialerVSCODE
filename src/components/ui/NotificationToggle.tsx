"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function NotificationToggle() {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    // Don't show anything if notifications aren't supported or already granted effectively
    // actually user might want to check status, but let's keep it simple as requested:
    // "hide it inside settings" or make it subtle
    if (!mounted || !('Notification' in window)) return null;

    if (permission === 'granted') return null; // Hide if already granted

    const requestPermission = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent widget expansion
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') {
            window.location.reload();
        }
    };

    return (
        <div
            onClick={requestPermission}
            className={cn(
                "h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 cursor-pointer",
                "bg-blue-600 text-white animate-pulse"
            )}
            title="Enable Notifications"
        >
            <Bell className="h-3 w-3 sm:h-4 sm:w-4" />
        </div>
    );
}
