"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * PushSync Component
 * 
 * SIMPLE approach: Just request permission on mount, no complex state management
 */
export function PushSync() {
    const { data: session } = useSession();
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [hasSynced, setHasSynced] = useState(false);

    // Step 1: Request permission and subscribe IMMEDIATELY on mount (iOS ONLY)
    useEffect(() => {
        const init = async () => {
            // Check support
            if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
                console.log('[PushSync] Push not supported');
                return;
            }

            console.log('[PushSync] Requesting notification permission...');

            // Just check if we have permission, don't request it automatically on load anymore
            // The user will request it via GlobalStatusWidget if needed
            const permission = Notification.permission;

            // If granted, proceed to subscribe

            if (permission !== 'granted') {
                console.log('[PushSync] Permission not granted');
                return;
            }

            // Wait for service worker
            const registration = await navigator.serviceWorker.ready;
            console.log('[PushSync] Service worker ready');

            // Get VAPID key (runtime only)
            const vapidKey = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : null;
            if (!vapidKey) {
                console.error('[PushSync] No VAPID key configured - push notifications will not work');
                console.error('[PushSync] Add NEXT_PUBLIC_VAPID_PUBLIC_KEY to Vercel environment variables');
                return;
            }

            console.log('[PushSync] VAPID key found, subscribing...');

            // Subscribe
            try {
                const sub = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidKey)
                });

                console.log('[PushSync] ✅ Subscribed to push');
                setSubscription(sub);
            } catch (err) {
                console.error('[PushSync] Subscribe failed:', err);
            }
        };

        init();
    }, []);

    // Step 2: Save to database when user is logged in
    useEffect(() => {
        if (!session?.user || !subscription || hasSynced) {
            return;
        }

        const save = async () => {
            try {
                const subJSON = subscription.toJSON();
                const response = await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        endpoint: subJSON.endpoint,
                        p256dh: subJSON.keys?.p256dh,
                        auth: subJSON.keys?.auth
                    })
                });

                if (response.ok) {
                    console.log('[PushSync] ✅ Saved to database');
                    setHasSynced(true);
                } else {
                    console.error('[PushSync] Save failed:', await response.text());
                }
            } catch (err) {
                console.error('[PushSync] Save error:', err);
            }
        };

        save();
    }, [session, subscription, hasSynced]);

    return null;
}

// Helper function
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer; // Return the buffer property
}
