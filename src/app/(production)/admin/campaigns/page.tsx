"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Loader2, Plus, Trash2, Users, Zap } from "lucide-react";

interface Campaign {
    id: string;
    name: string;
    createdAt: string;
    _count: { leads: number };
}

export default function AdminCampaignsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [seeding, setSeeding] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated") router.push("/auth/signin");
        else if (session?.user && session.user.role !== "ADMIN") router.push("/dialer");
    }, [status, session, router]);

    const fetchCampaigns = async () => {
        try {
            const res = await fetch("/api/campaigns");
            if (res.ok) {
                const data = await res.json();
                setCampaigns(data);
            }
        } catch (e) {
            console.error("Failed to fetch campaigns", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (session?.user?.role === "ADMIN") fetchCampaigns();
    }, [session]);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const res = await fetch("/api/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim() })
            });
            if (res.ok) {
                const campaign = await res.json();
                setCampaigns(prev => [...prev, campaign].sort((a, b) => a.name.localeCompare(b.name)));
                setNewName("");
            }
        } catch (e) {
            console.error("Failed to create campaign", e);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this campaign? Leads will be unassigned but not deleted.")) return;
        setDeleting(id);
        try {
            const res = await fetch(`/api/campaigns?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                setCampaigns(prev => prev.filter(c => c.id !== id));
            }
        } catch (e) {
            console.error("Failed to delete campaign", e);
        } finally {
            setDeleting(null);
        }
    };

    const handleSeed = async () => {
        setSeeding(true);
        const defaults = ["Solar Installers", "Therapists", "Chiropractors"];
        const existing = new Set(campaigns.map(c => c.name));
        for (const name of defaults) {
            if (!existing.has(name)) {
                try {
                    await fetch("/api/campaigns", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name })
                    });
                } catch (e) {
                    console.error(`Failed to seed "${name}"`, e);
                }
            }
        }
        await fetchCampaigns();
        setSeeding(false);
    };

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center text-slate-500">
                <Loader2 className="animate-spin mr-2" /> Loading Campaigns...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-8 pb-32">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-slate-900 mb-2">Campaign Management</h1>
                        <p className="text-slate-500">Create and manage lead campaigns for your dialer.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleSeed} disabled={seeding}>
                            {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                            Seed Defaults
                        </Button>
                        <Button variant="outline" onClick={() => router.push("/admin")}>
                            Back to Admin
                        </Button>
                    </div>
                </div>

                {/* CREATE CAMPAIGN */}
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-teal-600" />
                            New Campaign
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                                placeholder="e.g. Solar Installers"
                                className="flex-1 h-10 px-4 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            />
                            <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="bg-teal-600 hover:bg-teal-700 text-white">
                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* CAMPAIGN LIST */}
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-amber-600" />
                            Active Campaigns
                        </CardTitle>
                        <CardDescription>{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {campaigns.length === 0 ? (
                            <div className="py-12 text-center text-slate-400">
                                <Building2 className="h-8 w-8 mx-auto mb-3 opacity-50" />
                                <p className="text-sm">No campaigns yet. Create one above or click "Seed Defaults".</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {campaigns.map((c) => (
                                    <div key={c.id} className="flex items-center justify-between py-4 px-2 hover:bg-slate-50/50 rounded-lg transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
                                                <Building2 className="h-4 w-4 text-teal-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{c.name}</p>
                                                <p className="text-xs text-slate-400">
                                                    Created {new Date(c.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                                <Users className="h-3.5 w-3.5" />
                                                <span className="font-bold">{c._count.leads}</span>
                                                <span className="text-xs">leads</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(c.id)}
                                                disabled={deleting === c.id}
                                                className="text-red-400 hover:text-red-600 hover:bg-red-50"
                                            >
                                                {deleting === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
