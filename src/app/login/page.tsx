"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Redirect if already logged in
    useEffect(() => {
        if (status === "authenticated") {
            router.push("/dialer");
        }
    }, [status, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        console.log("[LOGIN] Starting login attempt for:", email);

        try {
            console.log("[LOGIN] Calling signIn... window.location.origin:", window.location.origin);
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
                callbackUrl: window.location.origin + "/dialer",
            });

            console.log("[LOGIN] signIn response received:", JSON.stringify(result));

            if (result?.error) {
                console.error("[LOGIN] Auth error from result:", result.error);

                // Specific check for database connection pool issues
                const isDbError = result.error.toLowerCase().includes('database') ||
                    result.error.toLowerCase().includes('pool') ||
                    result.error.toLowerCase().includes('max clients') ||
                    result.error.toLowerCase().includes('connection');

                if (isDbError) {
                    setError("Server is busy (Database connection pool full). Please wait a moment and try again.");
                } else {
                    setError("Invalid email or password");
                }
                setLoading(false);
            } else if (result?.ok) {
                console.log("[LOGIN] Success! Redirecting to /dialer");
                // Use a safe timeout to ensure any state updates finish
                setTimeout(() => {
                    router.push("/dialer");
                    // Hard redirect as a fallback if router.push fails or hangs
                    setTimeout(() => {
                        console.log("[LOGIN] Fallback: window.location.href = /dialer");
                        window.location.href = "/dialer";
                    }, 2000);
                }, 100);
            } else {
                console.error("[LOGIN] Unexpected result state:", result);
                setError("Login failed. Please try again.");
                setLoading(false);
            }
        } catch (err) {
            console.error("[LOGIN] CRITICAL Exception during login process:", err);
            // Log as much detail as possible for debugging
            if (err instanceof Error) {
                console.error("[LOGIN] Error name:", err.name);
                console.error("[LOGIN] Error message:", err.message);
                console.error("[LOGIN] Error stack:", err.stack);
            }
            setError(`Connection error: ${err instanceof Error ? err.message : 'Unknown'}`);
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
            <div className="w-full max-w-md space-y-8 p-8 rounded-2xl bg-card border border-border shadow-xl animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col items-center text-center">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                        <Zap className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome Back</h1>
                    <p className="mt-2 text-muted-foreground">Sign in to your PowerDialer account</p>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                Email Address
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                autoCapitalize="none"
                                className="mt-1 block w-full px-4 py-3 bg-muted/30 border border-input rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-medium"
                                placeholder="reps@example.com"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                Password
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                className="mt-1 block w-full px-4 py-3 bg-muted/30 border border-input rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-medium"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center shadow-lg shadow-primary/20"
                    >
                        {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Sign In"}
                    </button>
                </form>

                <div className="text-center pt-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                        Production Operator Workspace V2.0
                    </p>
                </div>
            </div>
        </div>
    );
}
