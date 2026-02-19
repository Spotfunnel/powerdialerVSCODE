"use client";

import { useTwilio } from "@/contexts/TwilioContext";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Radio, Server, Wifi } from "lucide-react";

export function AdminLiveStatus() {
    const { deviceState, deviceError } = useTwilio();
    const [systemStatus, setSystemStatus] = useState<any>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch("/api/admin/status");
                const data = await res.json();
                setSystemStatus(data);
                setLastRefreshed(new Date());
            } catch (e) {
                console.error("Status fetch failed", e);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const logs = systemStatus?.logs || [];
    const activeUsers = systemStatus?.users || [];
    const lastLog = logs[0];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Live System Status</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. BROWSER DEVICE STATUS */}
                <Card className="bg-white border-slate-200 text-slate-900 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                            <Wifi className="h-4 w-4" /> Browser Voice Device
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm">Status</span>
                                <Badge variant={deviceState === 'ready' ? "default" : "destructive"} className={deviceState === 'ready' ? "bg-green-600" : ""}>
                                    {deviceState.toUpperCase()}
                                </Badge>
                            </div>
                            {deviceError && (
                                <div className="text-[10px] text-red-400 mt-2 bg-red-50/50 p-1 rounded">
                                    {deviceError.message}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 2. PRESENCE STATUS */}
                <Card className="bg-white border-slate-200 text-slate-900 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                            <Activity className="h-4 w-4" /> Global Presence
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm">Online Users</span>
                                <span className="text-xl font-bold">{activeUsers.length}</span>
                            </div>
                            <div className="text-xs text-slate-500">
                                {activeUsers.map((u: any) => (
                                    <div key={u.id} className="truncate">{u.name} ({u.email})</div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. TWILIO WEBHOOK HEALTH */}
                <Card className="bg-white border-slate-200 text-slate-900 col-span-2 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                            <Server className="h-4 w-4" /> Last Inbound Webhook
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {lastLog ? (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="font-bold">
                                        {new Date(lastLog.timestamp).toDateString() === new Date().toDateString()
                                            ? new Date(lastLog.timestamp).toLocaleTimeString()
                                            : new Date(lastLog.timestamp).toLocaleString()}
                                    </span>
                                    <span className="font-mono">{lastLog.fromNumber} &rarr; {lastLog.toNumber}</span>
                                </div>
                                <div className="bg-slate-900 p-2 rounded text-[10px] font-mono text-green-400 overflow-x-auto whitespace-pre-wrap max-h-[100px]">
                                    {lastLog.twimlContent}
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500">No logs found.</div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div >
    );
}
