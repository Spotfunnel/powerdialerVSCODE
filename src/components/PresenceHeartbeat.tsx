"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useNotification } from "@/contexts/NotificationContext";

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function PresenceHeartbeat() {
    const { data: session } = useSession();
    const { addNotification } = useNotification();
    const lastCheckRef = useRef<string>(new Date(Date.now() - 10000).toISOString());

    useEffect(() => {
        if (!session?.user?.id) return;

        const registerPush = async () => {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                console.warn('Push notifications are not supported in this browser.');
                return;
            }

            // Check permission first
            if (Notification.permission === 'denied') {
                console.warn('Notification permission denied by user.');
                return;
            }

            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    console.warn('Notification permission not granted.');
                    return;
                }
            }

            try {
                const registration = await navigator.serviceWorker.ready;
                let subscription = await registration.pushManager.getSubscription();

                if (!subscription) {
                    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                    if (!publicKey) {
                        console.error('VAPID public key missing from environment.');
                        return;
                    }

                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(publicKey)
                    });
                }

                const response = await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(subscription)
                });

                if (response.ok) {
                    console.log('Push subscription successfully synced with backend.');
                } else {
                    const error = await response.json();
                    console.error('Failed to sync push subscription:', error);
                }
            } catch (err) {
                console.error('Push registration error:', err);
            }
        };

        registerPush();
    }, [session]);

    useEffect(() => {
        if (!session?.user?.id) return;

        const checkEvents = async () => {
            try {
                if (document.visibilityState !== 'visible') return;

                const res = await fetch(`/api/user/events?since=${encodeURIComponent(lastCheckRef.current)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.notifications && data.notifications.length > 0) {
                        data.notifications.forEach((n: any) => {
                            addNotification({
                                type: n.type,
                                title: n.title,
                                message: n.message,
                                duration: 8000
                            });
                        });
                    }
                    lastCheckRef.current = data.serverTime;
                }
            } catch (err) {
                console.error("Event check failed:", err);
            }
        };

        const ping = () => {
            // Essential: Send presence heartbeat even if tab is in background
            // so Twilio inbound routing knows this user is still available.
            navigator.sendBeacon("/api/user/presence");

            if (document.visibilityState === 'visible') {
                checkEvents(); // Only poll for UI notifications if visible
            }
        };

        // Initial check
        ping();

        const interval = setInterval(ping, 45000); // Poll every 45 seconds to balance presence with DB load

        return () => clearInterval(interval);
    }, [session, addNotification]);

    return null;
}
