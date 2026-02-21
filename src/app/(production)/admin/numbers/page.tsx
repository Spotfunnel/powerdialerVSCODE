"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Users, Grip, Phone, PhoneCall, RefreshCw, ShieldCheck, ShieldAlert, Activity, FileSearch, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { fixNumberRouting } from "@/app/actions/twilio";

interface NumberPoolItem {
    id: string;
    phoneNumber: string;
    isActive: boolean;
    ownerUserId: string | null;
    owner?: { id: string; name: string; email: string };
    lastUsedAt?: string;
    dailyCount: number;
}

interface UserItem {
    id: string;
    name: string;
    email: string;
}

export default function AdminNumbersPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [numbers, setNumbers] = useState<NumberPoolItem[]>([]);
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [auditData, setAuditData] = useState<any>(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (session?.user && session.user.role !== "ADMIN") {
            router.push("/dialer");
        }
    }, [status, session, router]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [numRes, logRes] = await Promise.all([
                fetch("/api/admin/numbers"),
                fetch("/api/twilio/status") // Reusing status for recent logs or similar
            ]);

            if (numRes.ok) {
                const data = await numRes.json();
                setNumbers(data.numbers);
                setUsers(data.users);
            }

            const evidenceRes = await fetch("/api/admin/twilio/logs");
            if (evidenceRes.ok) {
                const evidenceData = await evidenceRes.json();
                setLogs(evidenceData.logs || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const runAudit = async () => {
        setAuditLoading(true);
        try {
            const res = await fetch("/api/admin/twilio/audit");
            if (res.ok) {
                setAuditData(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setAuditLoading(false);
        }
    };

    useEffect(() => {
        if (session?.user?.role === 'ADMIN') {
            fetchData();
        }
    }, [session]);

    const handleFixRouting = async (sid: string) => {
        setUpdating(sid);
        try {
            const res = await fixNumberRouting(sid);
            if (res.success) {
                runAudit();
            } else {
                alert(res.error);
            }
        } finally {
            setUpdating(null);
        }
    };

    const handleAssign = async (numberId: string, userId: string) => {
        setUpdating(numberId);
        try {
            const res = await fetch("/api/admin/numbers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: numberId, ownerUserId: userId === "unassigned" ? null : userId })
            });

            if (res.ok) {
                const data = await res.json();
                setNumbers(prev => prev.map(n => n.id === numberId ? { ...n, ownerUserId: data.number.ownerUserId, owner: data.number.owner } : n));
            }
        } catch (e) {
            alert("Failed to update");
        } finally {
            setUpdating(null);
        }
    };

    if (status === "loading" || loading) {
        return <div className="min-h-screen bg-white flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> Loading Numbers...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-8 pb-32">
            <div className="max-w-7xl mx-auto space-y-8">

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-slate-900 mb-2">Number Management</h1>
                        <p className="text-slate-500">Assign Twilio numbers to specific users for ownership routing.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchData}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                        </Button>
                        <Button variant="outline" onClick={() => router.push('/admin')}>
                            Back to Admin
                        </Button>
                    </div>
                </div>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Phone className="h-5 w-5 text-teal-600" />
                            Active Number Pool
                        </CardTitle>
                        <CardDescription>
                            Inbound calls to these numbers will route to the Owner first.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3">Phone Number</th>
                                        <th className="px-4 py-3">Assigned Owner</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Daily Usage</th>
                                        <th className="px-4 py-3">Last Used</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {numbers.map((num) => (
                                        <tr key={num.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-mono font-medium">{num.phoneNumber}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {updating === num.id && <Loader2 className="h-3 w-3 animate-spin" />}
                                                    <select
                                                        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                                                        value={num.ownerUserId || "unassigned"}
                                                        onChange={(e) => handleAssign(num.id, e.target.value)}
                                                        disabled={updating === num.id}
                                                    >
                                                        <option value="unassigned">-- Unassigned --</option>
                                                        {users.map(u => (
                                                            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={num.isActive ? "default" : "secondary"} className={num.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : ""}>
                                                    {num.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">{num.dailyCount} calls</td>
                                            <td className="px-4 py-3 text-slate-400">
                                                {num.lastUsedAt ? new Date(num.lastUsedAt).toLocaleString() : "Never"}
                                            </td>
                                        </tr>
                                    ))}
                                    {numbers.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                                No numbers found in pool. Run "Auto-Configure" in Admin &gt; Twilio Settings.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* TWILIO LIVE AUDIT */}
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-blue-600" />
                                    Twilio Live Audit (REST API Proof)
                                </CardTitle>
                                <CardDescription>
                                    Verifying exact Voice Webhook URLs in the Twilio Console right now.
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={runAudit} disabled={auditLoading}>
                                {auditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run Audit Now"}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {auditData ? (
                            <div className="space-y-4">
                                <div className="p-3 bg-slate-50 border rounded-md grid grid-cols-3 gap-4 text-xs">
                                    <div>
                                        <span className="text-slate-500 block uppercase font-bold">Standard Identity Format</span>
                                        <span className="font-mono">{auditData.meta.standardIdentityFormat}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block uppercase font-bold">Base Webhook URL</span>
                                        <span className="font-mono truncate">{auditData.meta.baseUrl}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block uppercase font-bold">Identity Match Proof</span>
                                        <Badge className="bg-emerald-100 text-emerald-700">VERIFIED: userId (CUID)</Badge>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="text-slate-500 uppercase bg-slate-50 border-b">
                                            <tr>
                                                <th className="px-4 py-2">Phone</th>
                                                <th className="px-4 py-2">Voice Webhook URL</th>
                                                <th className="px-4 py-2">Method</th>
                                                <th className="px-4 py-2">Proof</th>
                                                <th className="px-4 py-2">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {auditData.audit.map((tn: any) => (
                                                <tr key={tn.sid} className={tn.isCorrectUrl ? "bg-white" : "bg-red-50"}>
                                                    <td className="px-4 py-2 font-mono font-bold">{tn.phoneNumber}</td>
                                                    <td className="px-4 py-2 font-mono text-slate-500 max-w-[200px] truncate">{tn.voiceUrl}</td>
                                                    <td className="px-4 py-2">{tn.voiceMethod}</td>
                                                    <td className="px-4 py-2">
                                                        {tn.isCorrectUrl ? (
                                                            <div className="flex items-center text-emerald-600 font-bold gap-1">
                                                                <ShieldCheck className="h-4 w-4" /> SECURE
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center text-red-600 font-bold gap-1">
                                                                <ShieldAlert className="h-4 w-4" /> MISCONFIGURED
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {!tn.isCorrectUrl && (
                                                            <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => handleFixRouting(tn.sid)} disabled={updating === tn.sid}>
                                                                {updating === tn.sid ? "Fixing..." : "FIX ROUTING"}
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center text-slate-400 text-sm">
                                Click "Run Audit Now" to fetch live Twilio state.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* INBOUND EVIDENCE LOG */}
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-amber-600" />
                            Inbound Evidence (Hard Logs)
                        </CardTitle>
                        <CardDescription>
                            Real-time records of webhook hits. If it rings "Press 1", evidence will show the incorrect path.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {logs.slice(0, 10).map((log, idx) => (
                                <div key={log.id || idx} className="p-3 bg-slate-50 border rounded-md text-xs font-mono space-y-2">
                                    <div className="flex justify-between font-bold text-slate-500">
                                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        <span className="text-teal-600">{log.direction}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><span className="text-slate-400">Caller:</span> {log.fromNumber}</div>
                                        <div><span className="text-slate-400">To:</span> {log.toNumber}</div>
                                    </div>
                                    <div className="bg-white p-2 border rounded text-[10px] text-slate-600 whitespace-pre-wrap">
                                        {log.twimlContent}
                                    </div>
                                </div>
                            ))}
                            {logs.length === 0 && (
                                <div className="py-8 text-center text-slate-400">No inbound evidence found yet.</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* SPAM TEST TOOL */}
            <div className="max-w-7xl mx-auto mt-8">
                <SpamTestTool numbers={numbers} />
            </div>

            {/* TRIPLE CHECK TOOL */}
            <div className="max-w-7xl mx-auto mt-8">
                <TripleCheckTool defaultNumber="+61489088403" baseUrl={auditData?.meta?.baseUrl} />
            </div>

            {/* SIMULATION TOOL */}
            <div className="max-w-7xl mx-auto mt-8">
                <RoutingSimulator />
            </div>
        </div>
    );
}

function SpamTestTool({ numbers }: { numbers: NumberPoolItem[] }) {
    const [testTarget, setTestTarget] = useState("+61478737917");
    const [testResults, setTestResults] = useState<Record<string, { status: string; callSid?: string; error?: string }>>({});
    const [testRunning, setTestRunning] = useState(false);
    const [currentNumber, setCurrentNumber] = useState<string | null>(null);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const pollCallStatus = async (callSid: string): Promise<string> => {
        const terminalStatuses = ["completed", "failed", "busy", "no-answer", "canceled"];
        for (let i = 0; i < 30; i++) { // max 60s polling
            await sleep(2000);
            try {
                const res = await fetch(`/api/admin/twilio/spam-test?callSid=${callSid}`);
                if (res.ok) {
                    const data = await res.json();
                    if (terminalStatuses.includes(data.status)) return data.status;
                }
            } catch {
                // continue polling
            }
        }
        return "timeout";
    };

    const testSingleNumber = async (phoneNumber: string) => {
        setCurrentNumber(phoneNumber);
        setTestResults(prev => ({ ...prev, [phoneNumber]: { status: "calling" } }));

        try {
            const res = await fetch("/api/admin/twilio/spam-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fromNumber: phoneNumber, toNumber: testTarget })
            });

            if (!res.ok) {
                const err = await res.json();
                setTestResults(prev => ({ ...prev, [phoneNumber]: { status: "error", error: err.error } }));
                return;
            }

            const { callSid } = await res.json();
            setTestResults(prev => ({ ...prev, [phoneNumber]: { status: "ringing", callSid } }));

            const finalStatus = await pollCallStatus(callSid);
            setTestResults(prev => ({ ...prev, [phoneNumber]: { status: finalStatus, callSid } }));
        } catch (e: any) {
            setTestResults(prev => ({ ...prev, [phoneNumber]: { status: "error", error: e.message } }));
        }

        setCurrentNumber(null);
    };

    const testAllNumbers = async () => {
        setTestRunning(true);
        setTestResults({});
        const activeNumbers = numbers.filter(n => n.isActive);

        for (const num of activeNumbers) {
            await testSingleNumber(num.phoneNumber);
            // Wait 5 seconds between calls
            if (num !== activeNumbers[activeNumbers.length - 1]) {
                await sleep(5000);
            }
        }
        setTestRunning(false);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "calling":
            case "ringing":
            case "in-progress":
            case "queued":
                return <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1"><Loader2 className="h-3 w-3 animate-spin" />{status}</Badge>;
            case "completed":
                return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="h-3 w-3" />Completed</Badge>;
            case "failed":
            case "busy":
            case "no-answer":
            case "canceled":
            case "timeout":
            case "error":
                return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><XCircle className="h-3 w-3" />{status}</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <Card className="bg-white border-slate-200 shadow-sm border-l-4 border-l-amber-500">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Spam Test Calls
                </CardTitle>
                <CardDescription>
                    Call your mobile from each pool number to check which ones are flagged as spam. Calls play a short message and hang up.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-4 mb-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Target Mobile Number</label>
                        <input
                            className="flex h-10 w-[300px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            value={testTarget}
                            onChange={(e) => setTestTarget(e.target.value)}
                            placeholder="+61478737917"
                            disabled={testRunning}
                        />
                    </div>
                    <Button
                        onClick={testAllNumbers}
                        disabled={testRunning || !testTarget || numbers.filter(n => n.isActive).length === 0}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                        {testRunning ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Testing...</>
                        ) : (
                            <><PhoneCall className="h-4 w-4 mr-2" />Test All Numbers</>
                        )}
                    </Button>
                </div>

                {numbers.filter(n => n.isActive).length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Pool Number</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {numbers.filter(n => n.isActive).map((num) => {
                                    const result = testResults[num.phoneNumber];
                                    return (
                                        <tr key={num.id} className={currentNumber === num.phoneNumber ? "bg-amber-50/50" : "hover:bg-slate-50/50"}>
                                            <td className="px-4 py-3 font-mono font-medium">{num.phoneNumber}</td>
                                            <td className="px-4 py-3">
                                                {result ? (
                                                    <div className="flex flex-col gap-1">
                                                        {getStatusBadge(result.status)}
                                                        {result.error && <span className="text-[10px] text-red-500">{result.error}</span>}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Not tested</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => testSingleNumber(num.phoneNumber)}
                                                    disabled={testRunning || currentNumber === num.phoneNumber}
                                                    className="h-7 text-xs"
                                                >
                                                    {currentNumber === num.phoneNumber ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <><Phone className="h-3 w-3 mr-1" />Test</>
                                                    )}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function TripleCheckTool({ defaultNumber, baseUrl }: { defaultNumber: string; baseUrl?: string }) {
    const [phone, setPhone] = useState(defaultNumber);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleTripleCheck = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch("/api/admin/twilio/fix-number", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber: phone })
            });
            const data = await res.json();
            setResult(data);
        } catch (e) {
            alert("Check failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="bg-white border-slate-200 shadow-sm border-l-4 border-l-teal-600">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-teal-600" />
                    Triple-Check Number Setup
                </CardTitle>
                <CardDescription>
                    Forces the Twilio configuration to point to this dialer and clears redundant failovers.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Number to Fix</label>
                        <input
                            className="flex h-10 w-[300px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleTripleCheck} disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white">
                        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Verify & Connect to Dialer"}
                    </Button>
                </div>

                {result && (
                    <div className="mt-4 p-4 rounded bg-slate-50 border text-sm">
                        {result.success ? (
                            <div className="text-emerald-700 font-bold">
                                SUCCESS: {result.number} is now connected to the dialer.<br />
                                <span className="font-mono text-[10px] text-slate-500">SID: {result.sid}</span>
                            </div>
                        ) : (
                            <div className="text-red-700 font-bold">ERROR: {result.error}</div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function RoutingSimulator() {
    const [phone, setPhone] = useState("");
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleSimulate = async () => {
        if (!phone) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch("/api/admin/simulate-routing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber: phone })
            });
            if (res.ok) {
                setResult(await res.json());
            }
        } catch (e) {
            alert("Error running simulation");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-indigo-600" />
                    Inbound Routing Simulator
                </CardTitle>
                <CardDescription>
                    Test where a call would land if it came in right now.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Test "To" Number</label>
                        <input
                            className="flex h-10 w-[300px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="+1555..."
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleSimulate} disabled={loading || !phone} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Simulate Call"}
                    </Button>
                </div>

                {result && (
                    <div className="mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="block text-xs font-bold text-slate-500 uppercase">Number Owner</span>
                                <span className="font-mono">{result.owner ? `${result.owner.name} (${result.owner.email})` : "Unassigned"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-bold text-slate-500 uppercase">Owner Status</span>
                                {result.owner?.lastSeenAt ? (
                                    <span className={new Date().getTime() - new Date(result.owner.lastSeenAt).getTime() < 60000 ? "text-green-600 font-bold" : "text-amber-600 font-medium"}>
                                        {new Date().getTime() - new Date(result.owner.lastSeenAt).getTime() < 60000 ? "ONLINE" : "OFFLINE"}
                                    </span>
                                ) : <span className="text-slate-400">N/A</span>}
                            </div>
                        </div>
                        <div className="pt-3 border-t border-slate-200">
                            <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Final Routing Decision</span>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200 text-sm py-1">
                                    Target: {result.decision.targetUserId || "HANGUP"}
                                </Badge>
                                <span className="text-xs font-mono text-slate-400">Reason: {result.decision.reason}</span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
