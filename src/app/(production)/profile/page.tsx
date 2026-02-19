import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CheckCircle2, XCircle, Calendar, Mail, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function ProfilePage({ searchParams }: { searchParams: { success?: string; error?: string } }) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        redirect("/login");
    }

    const userId = session.user.id;
    const connection = await prisma.calendarConnection.findUnique({
        where: { userId: userId }
    });

    const isConnected = !!connection;

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Your Profile</h1>
                    <p className="text-muted-foreground mt-2">Manage your integrations and account settings.</p>
                </div>
            </div>

            {searchParams.success === 'google_connected' && (
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5" />
                    <div>
                        <p className="font-bold">Successfully Connected!</p>
                        <p className="text-sm">Your Google Calendar is now linked. Emails will be sent from your address.</p>
                    </div>
                </div>
            )}

            {searchParams.error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5" />
                    <div>
                        <p className="font-bold">Connection Failed</p>
                        <p className="text-sm">Something went wrong connecting your account. Please try again.</p>
                        <p className="text-xs font-mono mt-1 opacity-75">{searchParams.error}</p>
                    </div>
                </div>
            )}

            <div className="grid gap-6">
                {/* Google Integration Card */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                                <Calendar className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">Google Workspace</h3>
                                <p className="text-sm text-muted-foreground">Sync your calendar and send emails from your own address.</p>
                            </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                            {isConnected ? "CONNECTED" : "NOT CONNECTED"}
                        </div>
                    </div>

                    <div className="mt-8">
                        {isConnected ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm text-green-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>Calendar Sync Active</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-green-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>Gmail Sending Active</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-4">Last updated: {connection.updatedAt.toLocaleDateString()}</p>

                                {/* Alias Configuration Form */}
                                <div className="p-6 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
                                    <h4 className="font-bold text-sm text-zinc-700 uppercase tracking-wider">Email Alias Settings</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Send booking confirmations as a specific persona (e.g. "Kye Walker").
                                        <br />
                                        <span className="text-amber-600 font-bold">Important:</span> The email must be a verified alias in your Gmail settings.
                                    </p>

                                    <form action="/api/integrations/google/settings" method="POST" className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-zinc-500 uppercase">Sender Name</label>
                                                <input
                                                    name="senderName"
                                                    defaultValue={connection.senderName || ""}
                                                    placeholder="e.g. Kye Walker"
                                                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-zinc-500 uppercase">Sender Email (Alias)</label>
                                                <input
                                                    name="senderEmail"
                                                    defaultValue={connection.senderEmail || ""}
                                                    placeholder="e.g. kye@getspotfunnel.com"
                                                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 text-sm"
                                                />
                                            </div>
                                        </div>
                                        <button type="submit" className="px-4 py-2 bg-black text-white text-sm font-bold rounded-lg hover:bg-zinc-800 transition-colors">
                                            Save Alias Settings
                                        </button>
                                    </form>
                                </div>

                                <div className="pt-4 border-t border-border mt-4">
                                    <Link href="/api/integrations/google/connect" className="text-sm text-blue-600 hover:underline">
                                        Reconnect / Update Permissions
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-yellow-800 text-sm flex gap-3">
                                    <AlertTriangle className="h-5 w-5 shrink-0" />
                                    <p>Your emails are currently being sent via the default System Account. They will not appear in your usage logs or "Sent" folder until you connect.</p>
                                </div>
                                <Link
                                    href="/api/integrations/google/connect"
                                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all"
                                >
                                    <Mail className="h-4 w-4" />
                                    Connect Google Account
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
