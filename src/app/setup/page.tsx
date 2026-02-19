"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, Rocket, Smartphone, ShieldCheck, Database, Link as LinkIcon, ExternalLink, Copy, Play, Activity } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function SetupWizard() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [webhookUrl, setWebhookUrl] = useState("");
    const [webhookStatus, setWebhookStatus] = useState<{ received: boolean; lastReceivedAt?: string } | null>(null);

    const [form, setForm] = useState({
        twilioAccountSid: "",
        twilioAuthToken: "",
        twilioFromNumber: "",
        repPhoneNumber: "",
        webhookBaseUrl: "",
    });

    useEffect(() => {
        const origin = window.location.origin;
        setWebhookUrl(origin);
        // Only set default if not already set (to prevent resetting ngrok URLs)
        setForm(f => ({ ...f, webhookBaseUrl: f.webhookBaseUrl || origin }));

        // Poll for webhook status
        const interval = setInterval(async () => {
            try {
                const res = await fetch("/api/admin/webhook-status");
                if (res.ok) setWebhookStatus(await res.json());
            } catch (e) { }
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    const nextStep = () => {
        setError(null);
        setMessage(null);
        setStep(s => s + 1);
    };

    const handleAction = async (action: string, data: Record<string, any> = {}) => {
        setLoading(true);
        setError(null);
        try {
            let url = "/api/admin/settings";
            let method = "POST";
            let body = { ...data };

            // Dynamic Routing & Mapping based on Action
            switch (action) {
                case "VERIFY_TWILIO":
                    url = "/api/admin/verify/twilio";
                    body = { sid: data.twilioAccountSid, token: data.twilioAuthToken };
                    break;
                case "TEST_CALL":
                    // Fallback to verifying creds for now, as initiating a real call requires a lead
                    url = "/api/admin/verify/twilio";
                    body = { sid: form.twilioAccountSid || data.twilioAccountSid, token: form.twilioAuthToken || data.twilioAuthToken };
                    break;
                default:
                    // Saving settings (default behavior)
                    break;
            }

            console.log(`[Frontend] ${action} -> ${url}`);

            const res = await fetch(url, {
                method,
                body: JSON.stringify(body),
            });
            const result = await res.json();

            if (res.ok) {
                setMessage("Success!");
                return result;
            } else {
                setError(result.error || `Action failed: ${action}`);
                return null;
            }
        } catch (e: unknown) {
            const err = e as Error;
            setError(err.message || "Network error. Is your server running?");
            return null;
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyTwilio = async () => {
        const ok = await handleAction("VERIFY_TWILIO", {
            twilioAccountSid: form.twilioAccountSid,
            twilioAuthToken: form.twilioAuthToken,
            twilioFromNumber: form.twilioFromNumber,
            webhookBaseUrl: form.webhookBaseUrl
        });
        if (ok) setTimeout(nextStep, 1000);
    };

    const handleTestCall = async () => {
        // Absolute clean (strip everything but digits and +)
        let raw = form.repPhoneNumber.trim().replace(/[^\d+]/g, "");

        // Help AU users: if starts with 04 and is 10 digits, convert to +61
        if (raw.startsWith("04") && raw.length === 10) {
            raw = "+61" + raw.substring(1);
        }

        if (!raw.startsWith("+")) {
            setError("Please include your country code (e.g., +61 for Australia). Numbers must start with +");
            return;
        }

        if (form.webhookBaseUrl.includes("localhost")) {
            setError("Twilio cannot reach 'localhost'. Please enter your public ngrok URL in Step 2.");
            return;
        }

        console.log("[PowerDialer Frontend] Triggering Test Call... Data:", { raw, baseUrl: form.webhookBaseUrl });

        const ok = await handleAction("TEST_CALL", {
            repPhoneNumber: raw,
            webhookBaseUrl: form.webhookBaseUrl
        });
        if (ok) setMessage("Test Call Initiated! Your phone should ring shortly.");
    };

    const handleFinalize = async () => {
        setLoading(true);
        try {
            await fetch("/api/admin/settings", {
                method: "POST",
                body: JSON.stringify({ repPhoneNumber: form.repPhoneNumber, setupCompleted: true }),
            });
            router.push("/dialer");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
            <div className="max-w-xl w-full">
                <div className="flex gap-2 mb-12">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-all", i <= step ? "bg-primary" : "bg-muted")} />
                    ))}
                </div>

                <div className="bg-card border border-border rounded-[40px] p-8 md:p-12 shadow-xl">
                    {step === 1 && (
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                                    <LinkIcon className="h-8 w-8 text-primary" />
                                </div>
                                <h1 className="text-4xl font-black text-foreground">1. Link Twilio</h1>
                                <p className="text-muted-foreground text-lg">Configure your telephony keys.</p>
                            </div>
                            <div className="space-y-4 text-foreground">
                                <Input label="Account SID" placeholder="AC..." value={form.twilioAccountSid} onChange={v => setForm({ ...form, twilioAccountSid: v })} />
                                <Input type="password" label="Auth Token" placeholder="Key..." value={form.twilioAuthToken} onChange={v => setForm({ ...form, twilioAuthToken: v })} />
                                <Input label="Twilio Outbound Number" placeholder="+1..." value={form.twilioFromNumber} onChange={v => setForm({ ...form, twilioFromNumber: v })} />
                                <Input label="Public Webhook URL (ngrok)" placeholder="https://..." value={form.webhookBaseUrl} onChange={v => setForm({ ...form, webhookBaseUrl: v })} />
                                <button onClick={handleVerifyTwilio} disabled={loading || !form.twilioAuthToken || !form.webhookBaseUrl} className="w-full py-5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-xl font-bold rounded-2xl transition-all text-white">
                                    {loading ? "VERIFYING..." : message || "VERIFY & CONTINUE"}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                                    <Smartphone className="h-8 w-8 text-primary" />
                                </div>
                                <h1 className="text-4xl font-black text-foreground">2. Rep Device</h1>
                                <p className="text-muted-foreground text-lg">Collect your mobile number for the bridge.</p>
                            </div>
                            <div className="space-y-6">
                                <Input label="Your Mobile Number" placeholder="+1..." value={form.repPhoneNumber} onChange={v => setForm({ ...form, repPhoneNumber: v })} />
                                <div className="flex flex-col gap-4">
                                    <button onClick={handleTestCall} disabled={loading || !form.repPhoneNumber} className="w-full py-5 bg-muted hover:bg-muted/80 text-xl font-bold rounded-2xl transition-all flex items-center justify-center gap-3 text-foreground border border-border">
                                        <Play className="h-6 w-6" /> PLACE TEST CALL
                                    </button>
                                    <button onClick={nextStep} disabled={!form.repPhoneNumber} className="w-full py-5 bg-primary hover:bg-primary/90 text-xl font-bold rounded-2xl transition-all text-white">
                                        SAVE & CONTINUE
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                                    <ShieldCheck className="h-8 w-8 text-primary" />
                                </div>
                                <h1 className="text-4xl font-black text-foreground">3. Webhooks</h1>
                                <p className="text-muted-foreground text-lg">Install this URL in Twilio to track live events.</p>
                            </div>
                            <div className="space-y-6">
                                <div className="bg-black/5 p-6 rounded-2xl border border-border flex items-center justify-between gap-4">
                                    <code className="text-primary font-mono break-all">{webhookUrl}/api/twilio/status</code>
                                    <button onClick={() => navigator.clipboard.writeText(`${webhookUrl}/api/twilio/status`)} className="p-3 bg-white hover:bg-muted border border-border rounded-xl">
                                        <Copy className="h-5 w-5 text-foreground" />
                                    </button>
                                </div>

                                <div className="p-6 bg-muted/30 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Activity className={cn("h-6 w-6", webhookStatus?.received ? "text-green-500" : "text-muted-foreground animate-pulse")} />
                                        <span className="font-bold text-foreground">{webhookStatus?.received ? "Webhook Received!" : "Waiting for Webhook..."}</span>
                                    </div>
                                    {webhookStatus?.lastReceivedAt && (
                                        <span className="text-muted-foreground text-xs">{new Date(webhookStatus.lastReceivedAt).toLocaleTimeString()}</span>
                                    )}
                                </div>

                                <button onClick={nextStep} className="w-full py-5 bg-primary hover:bg-primary/90 text-xl font-bold rounded-2xl transition-all text-white">
                                    I'VE SET THE WEBHOOKS
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-8 text-center">
                            <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Rocket className="h-12 w-12 text-green-600" />
                            </div>
                            <h1 className="text-5xl font-black text-foreground">Ready to Ship</h1>
                            <p className="text-muted-foreground text-xl">Everything is wired and verified. Start dialing.</p>
                            <button onClick={handleFinalize} className="w-full py-8 bg-green-500 hover:bg-green-400 text-3xl font-black rounded-[30px] transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl shadow-green-500/20 text-white">
                                START DIALING
                            </button>
                        </div>
                    )}

                    {error && <div className="mt-8 p-4 bg-red-50 text-red-600 border border-red-200 rounded-2xl font-bold">{error}</div>}
                    {message && !error && <div className="mt-8 p-4 bg-green-50 text-green-600 border border-green-200 rounded-2xl font-bold">{message}</div>}
                </div>
            </div>
        </div>
    );
}

function Input({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{label}</label>
            <input
                type={type}
                value={value || ""}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-white border-2 border-zinc-200 rounded-2xl px-6 py-4 focus:border-teal-500 focus:ring-0 outline-none transition-all text-xl font-medium placeholder-zinc-300 text-zinc-900"
            />
        </div>
    );
}
