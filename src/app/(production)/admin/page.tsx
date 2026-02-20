"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Phone, BarChart3, Settings, LogOut, Shield, RefreshCw, Building2 } from "lucide-react";
import { AutoConfigureButton } from "@/components/admin/AutoConfigureButton";
import { AdminLiveStatus } from "@/components/AdminLiveStatus";

export default function AdminPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (session?.user && session.user.role !== "ADMIN") {
            router.push("/dialer");
        }
    }, [status, session, router]);

    if (status === "loading" || !session?.user || session.user.role !== "ADMIN") {
        return <div className="min-h-screen bg-white flex items-center justify-center text-slate-500">Loading Admin...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-8 pb-32">
            <div className="max-w-7xl mx-auto space-y-8">

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-slate-900 mb-2">Admin Command</h1>
                        <p className="text-slate-500">System controls and configuration.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => window.location.href = '/dialer'}>
                            Exit to Dialer
                        </Button>
                    </div>
                </div>

                {/* LIVE STATUS PANEL */}
                <Card className="bg-white border-slate-200 border-l-4 border-l-green-500 shadow-md">
                    <CardContent className="p-6">
                        <AdminLiveStatus />
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* CAMPAIGNS */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-amber-600" />
                                Campaigns
                            </CardTitle>
                            <CardDescription>Create and manage lead campaigns for the dialer.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                onClick={() => router.push('/admin/campaigns')}
                                className="w-full bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                Manage Campaigns
                            </Button>
                        </CardContent>
                    </Card>

                    {/* TWILIO CONFIGURATION */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5 text-teal-600" />
                                Twilio Configuration
                            </CardTitle>
                            <CardDescription>Manage your Twilio connection and webhooks.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Account SID</span>
                                    <span className="font-mono text-slate-700">...{process.env.NEXT_PUBLIC_TWILIO_ACCOUNT_SID?.slice(-4)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">App SID</span>
                                    <span className="font-mono text-slate-700">{process.env.NEXT_PUBLIC_TWILIO_APP_SID || "Not Configured"}</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <AutoConfigureButton />
                            </div>
                        </CardContent>
                    </Card>

                    {/* NUMBER MANAGEMENT */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Phone className="h-5 w-5 text-indigo-600" />
                                Phone Numbers
                            </CardTitle>
                            <CardDescription>Manage Twilio numbers, owner assignment, and routing simulation.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                onClick={() => router.push('/admin/numbers')}
                                className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                Manage Numbers
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
