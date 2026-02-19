import webpush from 'web-push';

const vapidKeys = {
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
};

webpush.setVapidDetails(
    'mailto:support@spotfunnel.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

export async function sendPushNotification(subscription: any, payload: any) {
    try {
        await webpush.sendNotification(
            subscription,
            JSON.stringify(payload)
        );
        return { success: true };
    } catch (error: any) {
        console.error('Error sending push notification:', error);
        if (error.statusCode === 404 || error.statusCode === 410) {
            // Subscription has expired or is no longer valid
            return { success: false, expired: true };
        }
        return { success: false, error: error.message };
    }
}
