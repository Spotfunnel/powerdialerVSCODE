"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Briefcase, CheckCircle2, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineWizardProps {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
    companyName: string;
    onSuccess: () => void;
}

const STAGES = [
    { id: "BOOKED", label: "Demo Booked", color: "bg-teal-600", icon: "📅" },
    { id: "SOLD", label: "Sold", color: "bg-emerald-600", icon: "🏆" },
    { id: "KEY_INFO_COLLECTED", label: "Key Info Collected", color: "bg-indigo-600", icon: "📝" },
    { id: "ONBOARDED", label: "Onboarded", color: "bg-blue-600", icon: "🚀" }
];

export function PipelineWizard({ isOpen, onClose, leadId, companyName, onSuccess }: PipelineWizardProps) {
    const [selectedStage, setSelectedStage] = useState(STAGES[0].id);
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/crm/pipeline-move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId, stage: selectedStage, notes })
            });

            const data = await res.json();

            if (res.ok) {
                onSuccess();
                onClose();
                // Reset state
                setNotes("");
                setSelectedStage(STAGES[0].id);
            } else {
                setError(data.error || "Failed to move lead");
            }
        } catch (err) {
            setError("Network error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Update Pipeline Stage"
            width="max-w-lg"
        >
            <div className="space-y-6">
                {/* Header Context */}
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shadow-sm shrink-0">
                        <Briefcase className="h-5 w-5 text-zinc-400 stroke-[2]" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Moving Lead</p>
                        <h3 className="text-lg font-bold text-zinc-900 leading-none">{companyName}</h3>
                    </div>
                </div>

                {/* Stage Selection */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Select Destinaton Stage</label>
                    <div className="grid grid-cols-1 gap-2">
                        {STAGES.map((stage) => (
                            <button
                                key={stage.id}
                                onClick={() => setSelectedStage(stage.id)}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border transition-all text-left group",
                                    selectedStage === stage.id
                                        ? "bg-zinc-900 border-zinc-900 text-white shadow-lg scale-[1.02]"
                                        : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-600"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{stage.icon}</span>
                                    <span className={cn(
                                        "text-sm font-bold",
                                        selectedStage === stage.id ? "text-white" : "text-zinc-700"
                                    )}>{stage.label}</span>
                                </div>
                                {selectedStage === stage.id && (
                                    <CheckCircle2 className="h-4 w-4 text-white" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Movement Notes (Optional)</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add context about this move..."
                        className="w-full h-24 p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:border-zinc-400 focus:ring-0 placeholder:text-zinc-400 resize-none transition-all"
                    />
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p className="text-xs font-bold">{error}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 h-12 rounded-xl border border-zinc-200 font-bold text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 h-12 rounded-xl bg-zinc-900 text-white font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Confirm Move
                    </button>
                </div>
            </div>
        </Modal>
    );
}
