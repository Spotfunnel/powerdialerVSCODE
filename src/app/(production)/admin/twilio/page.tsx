import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AutoConfigureButton } from "@/components/admin/AutoConfigureButton";

export default async function TwilioDebuggerPage() {
    const session = await getServerSession(authOptions);

    // Basic auth check - assuming role property exists. Adjust if schema differs.
    if (!session?.user) {
        redirect('/auth/signin');
    }

    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    const envBaseUrl = process.env.WEBHOOK_BASE_URL;
    const dbBaseUrl = settings?.webhookBaseUrl;

    // Masking helper
    const mask = (s: string | undefined | null) => s ? s.slice(0, 4) + '...' + s.slice(-4) : '(Not Set)';

    const effectiveBaseUrl = dbBaseUrl || envBaseUrl;
    const isLocalhost = effectiveBaseUrl?.includes('localhost');

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Twilio Connectivity</h1>
                    <p className="text-muted-foreground mt-2">Diagnose and verify your telephony configuration.</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${isLocalhost ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {isLocalhost ? 'Localhost Detected (Webhooks specific to dev)' : 'Production / Tunnel Mode'}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Credentials Card */}
                <section className="bg-card border rounded-lg shadow-sm p-6">
                    <h2 className="text-xl font-semibold mb-4">Credentials & Settings</h2>
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="font-medium text-muted-foreground">Account SID</span>
                            <span className="font-mono">{mask(settings?.twilioAccountSid)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="font-medium text-muted-foreground">Auth Token</span>
                            <span className="font-mono text-xs">{settings?.twilioAuthToken ? '●●●●●●●●' : '(Not Set)'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="font-medium text-muted-foreground">Twilio Number</span>
                            <span className="font-mono">{settings?.twilioFromNumbers || '(Not Set)'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="font-medium text-muted-foreground">TwiML App SID</span>
                            <span className="font-mono">{settings?.twilioAppSid || '(Not Set)'}</span>
                        </div>
                    </div>
                </section>

                {/* Configuration Card */}
                <section className="bg-card border rounded-lg shadow-sm p-6">
                    <h2 className="text-xl font-semibold mb-4">Webhook Status</h2>

                    <div className="mb-6">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Public Base URL</label>
                        <code className={`block mt-1 p-2 rounded text-sm break-all ${effectiveBaseUrl ? 'bg-slate-100 dark:bg-slate-800' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                            {effectiveBaseUrl || "MISSING: Set in Settings or .env"}
                        </code>
                        {isLocalhost && (
                            <p className="text-xs text-red-500 mt-1">Twilio cannot reach localhost URLs directly.</p>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-md">
                            <h3 className="font-bold text-blue-700 dark:text-blue-400 text-xs uppercase mb-1">Inbound (Phone Number)</h3>
                            <div className="font-mono text-xs break-all">
                                {effectiveBaseUrl}/api/twilio/inbound
                            </div>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900 rounded-md">
                            <h3 className="font-bold text-green-700 dark:text-green-400 text-xs uppercase mb-1">Outbound (TwiML App)</h3>
                            <div className="font-mono text-xs break-all">
                                {effectiveBaseUrl}/api/voice/twiml
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <section className="bg-amber-50 dark:bg-amber-950/20 p-6 rounded-lg border border-amber-200 dark:border-amber-900">
                <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-500 mb-2">Troubleshooting Guide</h2>
                <ul className="list-disc pl-5 text-sm text-amber-900 dark:text-amber-400 space-y-2">
                    <li>
                        <strong>Inbound calls failing?</strong> Check that your Twilio Phone Number configuration in the Twilio Console points to the <code>Inbound</code> URL above. If using a Tunnel (ngrok), ensure it is running and the URL matches.
                    </li>
                    <li>
                        <strong>Outbound calls failing?</strong> Verify your TwiML App Voice URL matches the <code>Outbound</code> URL.
                    </li>
                    <li>
                        <strong>Calls go straight to voicemail?</strong> This usually means no Browser Client is connected with the correct Identity. Refresh the dialer page to register the Websocket.
                    </li>
                </ul>
            </section>
        </div>
    );
}
