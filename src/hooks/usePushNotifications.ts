"use client";

import { useEffect, useState } from "react";

// Helper to convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications() {
    // Check support IMMEDIATELY, not in useEffect
    const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

    const [isSupported] = useState(supported);
    const [permission, setPermission] = useState<NotificationPermission>(
        typeof window !== 'undefined' && supported ? Notification.permission : 'default'
    );
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Log support status for debugging
    useEffect(() => {
        console.log('[usePushNotifications] Initialized:', {
            isSupported,
            permission,
            hasServiceWorker: 'serviceWorker' in navigator,
            hasPushManager: 'PushManager' in window,
            hasNotification: 'Notification' in window
        });
    }, []);

    const requestPermission = async (): Promise<boolean> => {
        if (!isSupported) {
            setError('Push notifications not supported');
            return false;
        }

        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            return result === 'granted';
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    const subscribe = async (): Promise<PushSubscription | null> => {
        if (!isSupported) {
            setError('Push notifications not supported');
            return null;
        }

        if (permission !== 'granted') {
            const granted = await requestPermission();
            if (!granted) {
                setError('Permission denied');
                return null;
            }
        }

        try {
            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;

            // Get VAPID public key from environment
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                throw new Error('VAPID public key not configured');
            }

            // Subscribe to push
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
            });

            setSubscription(sub);
            setError(null);
            return sub;
        } catch (err: any) {
            console.error('[Push] Subscription failed:', err);
            setError(err.message);
            return null;
        }
    };

    const unsubscribe = async (): Promise<boolean> => {
        if (!subscription) return false;

        try {
            await subscription.unsubscribe();
            setSubscription(null);
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    return {
        isSupported,
        permission,
        subscription,
        error,
        requestPermission,
        subscribe,
        unsubscribe
    };
}
