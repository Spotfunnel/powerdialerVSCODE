"use client";

import { useMemo, useState, useEffect } from "react";
import {
    Layout, Plus, Zap, CheckCircle2, Target, Send,
    AlertCircle, FileText, Loader2, Trash2, Phone,
    GripVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Lead } from "@/types/dialer";
import { PIPELINE_STAGES } from "@/lib/types";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/contexts/ToastContext";

// DND Kit Imports
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ICON_MAP: Record<string, any> = {
    "NEW": Plus,
    "CONTACTED": Send,
    "QUALIFIED": Target,
    "BOOKED": CheckCircle2,
    "SOLD": Target,
    "OTHER": AlertCircle
};

// --- Droppable Column Component ---
function PipelineColumn({ stage, leads, onDial, onDelete }: {
    stage: any,
    leads: Lead[],
    onDial: (l: Lead) => void,
    onDelete: (id: string) => void
}) {
    const { setNodeRef } = useSortable({
        id: stage.status,
        data: {
            type: 'Column',
            stage
        }
    });

    return (
        <div ref={setNodeRef} className="w-[280px] sm:w-[320px] flex flex-col gap-4">
            {/* Header */}
            <div className="relative group">
                <div className="relative flex items-center justify-between bg-white border border-zinc-100 p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md text-white border-b-4 border-black/10",
                            getHeaderBg(stage.color)
                        )}>
                            <stage.icon className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 className="font-black text-[10px] uppercase tracking-widest text-black italic">{stage.name}</h3>
                            <span className="text-[9px] font-black text-zinc-400">
                                {leads.length} ASSETS
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Column Surface */}
            <div className="flex-1 bg-zinc-100/40 rounded-[2.5rem] border border-zinc-200/50 p-4 space-y-4 overflow-y-auto custom-scrollbar min-h-[500px]">
                <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                    {leads.map(lead => (
                        <SortableLeadCard
                            key={lead.id}
                            lead={lead}
                            color={stage.color}
                            onDial={onDial}
                            onDelete={onDelete}
                        />
                    ))}
                </SortableContext>

                <AddLeadButton />
            </div>
        </div>
    );
}

// --- Sortable Lead Card Component ---
function SortableLeadCard({ lead, color, onDial, onDelete, isOverlay = false }: {
    lead: Lead,
    color: string,
    onDial: (l: Lead) => void,
    onDelete: (id: string) => void,
    isOverlay?: boolean
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: lead.id,
        data: {
            type: 'Lead',
            lead
        }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "bg-white border rounded-xl sm:rounded-2xl p-3 sm:p-5 transition-all duration-300 group relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-teal-500",
                !isOverlay && "hover:shadow-xl hover:-translate-y-1",
                !lead.phoneNumber && "opacity-60 grayscale-[0.5]",
                color === 'teal' && "border-teal-100 hover:border-teal-400",
                color === 'emerald' && "border-emerald-100 hover:border-emerald-400",
                color === 'indigo' && "border-indigo-100 hover:border-indigo-400",
                color === 'blue' && "border-blue-100 hover:border-blue-400",
                isOverlay && "shadow-2xl ring-2 ring-teal-500 cursor-grabbing"
            )}
        >
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-2">
                    <button
                        {...attributes}
                        {...listeners}
                        className="p-1 hover:bg-zinc-100 rounded cursor-grab active:cursor-grabbing text-zinc-300"
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                    <span className={cn(
                        "text-[9px] font-black px-3 py-1.5 rounded-lg border uppercase tracking-widest shadow-sm",
                        color === 'teal' && "bg-teal-50 border-teal-100 text-teal-700",
                        color === 'emerald' && "bg-emerald-50 border-emerald-100 text-emerald-700",
                        color === 'indigo' && "bg-indigo-50 border-indigo-100 text-indigo-700",
                        color === 'blue' && "bg-blue-50 border-blue-100 text-blue-700",
                    )}>
                        {!lead.phoneNumber ? "NO PHONE" : "$3k UNIT"}
                    </span>
                </div>

                <div className="flex gap-1.5 relative z-10">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(lead.id);
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-50 border border-zinc-100 text-zinc-300 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"
                    >
                        <Trash2 className="h-3.5 w-3.5 stroke-[2.5]" />
                    </button>
                </div>
            </div>

            <div className="relative z-10">
                <h4 className="font-black text-lg sm:text-2xl text-black italic mb-1 sm:mb-2 leading-tight tracking-tight truncate" title={lead.companyName}>{lead.companyName || "Unknown Company"}</h4>
                <p className="text-[9px] sm:text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] truncate">{lead.firstName} {lead.lastName}</p>
            </div>

            <div className="flex items-center justify-between mt-4 sm:mt-8 pt-4 sm:pt-6 border-t border-zinc-50 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-zinc-100 border-2 sm:border-4 border-white flex items-center justify-center text-[9px] sm:text-[11px] font-black text-zinc-400 shadow-sm transition-transform group-hover:translate-x-1">
                        {lead.attempts}
                    </div>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDial(lead);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 group/dial"
                >
                    <Phone className="h-3 w-3 fill-current group-hover/dial:animate-pulse" />
                    Dial
                </button>
            </div>
        </div>
    );
}

function AddLeadButton() {
    const router = useRouter();
    return (
        <button
            onClick={() => router.push("/contacts/import")}
            className="w-full py-10 border-2 border-dashed border-zinc-200 rounded-[2.5rem] text-zinc-300 hover:text-teal-600 hover:border-teal-200 hover:bg-white transition-all flex flex-col items-center justify-center gap-3 group"
        >
            <Plus className="h-8 w-8 stroke-[3] group-hover:scale-125 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Operational Injection</span>
        </button>
    );
}

// --- Helper Funcs ---
const getHeaderBg = (color: string) => {
    switch (color) {
        case 'teal': return 'bg-teal-600';
        case 'emerald': return 'bg-emerald-600';
        case 'indigo': return 'bg-indigo-600';
        case 'blue': return 'bg-blue-600';
        default: return 'bg-zinc-900';
    }
};

// --- Main Page Component ---
export default function PipelinePage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeLead, setActiveLead] = useState<Lead | null>(null);

    const pipelines = useMemo(() => PIPELINE_STAGES.map(stage => ({
        ...stage,
        icon: ICON_MAP[stage.status] || FileText
    })), []);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const baseUrl = window.location.origin;
            const res = await fetch(`${baseUrl}/api/crm/pipeline/leads`);
            if (res.ok) {
                const data = await res.json();
                setLeads(data.leads || []);
            } else {
                showToast("Failed to load pipeline data", "error");
            }
        } catch (error) {
            console.error("Failed to fetch leads for pipeline", error);
            showToast("Network error loading pipeline", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [leadToDelete, setLeadToDelete] = useState<string | null>(null);

    const handleDeleteClick = (leadId: string) => {
        setLeadToDelete(leadId);
        setConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!leadToDelete) return;
        try {
            const res = await fetch(`/api/crm/contacts/${leadToDelete}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setLeads(current => current.filter(l => l.id !== leadToDelete));
                showToast("Lead removed from pipeline", "success");
            } else {
                showToast("Failed to remove lead", "error");
            }
        } catch (error) {
            showToast("Error removing lead", "error");
        } finally {
            setLeadToDelete(null);
        }
    };

    const handleDial = (lead: Lead) => {
        if (!lead.phoneNumber) {
            showToast("No phone number for this lead!", "error");
            return;
        }
        router.push(`/dialer?leadId=${lead.id}`);
    };

    // --- DND Handlers ---
    const onDragStart = (event: DragStartEvent) => {
        if (event.active.data.current?.type === 'Lead') {
            setActiveLead(event.active.data.current.lead);
        }
    };

    const onDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveALead = active.data.current?.type === 'Lead';
        const isOverALead = over.data.current?.type === 'Lead';
        const isOverAColumn = over.data.current?.type === 'Column';

        if (!isActiveALead) return;

        // Dropping over another lead in a different column
        if (isActiveALead && isOverALead) {
            setLeads((leads) => {
                const activeIndex = leads.findIndex((l) => l.id === activeId);
                const overIndex = leads.findIndex((l) => l.id === overId);

                if (leads[activeIndex].status !== leads[overIndex].status) {
                    leads[activeIndex].status = leads[overIndex].status;
                    return arrayMove(leads, activeIndex, overIndex);
                }

                return arrayMove(leads, activeIndex, overIndex);
            });
        }

        // Dropping over a column
        if (isActiveALead && isOverAColumn) {
            setLeads((leads) => {
                const activeIndex = leads.findIndex((l) => l.id === activeId);
                leads[activeIndex].status = overId as string;
                return arrayMove(leads, activeIndex, activeIndex);
            });
        }
    };

    const onDragEnd = async (event: DragEndEvent) => {
        setActiveLead(null);
        const { active, over } = event;
        if (!over) return;

        const activeLead = active.data.current?.lead;
        const newStatus = over.data.current?.type === 'Column'
            ? over.id as string
            : (over.data.current?.lead as Lead)?.status;

        if (activeLead && newStatus && activeLead.status !== newStatus) {
            // Persist change
            try {
                const res = await fetch('/api/crm/pipeline/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ leadId: activeLead.id, status: newStatus })
                });
                if (!res.ok) {
                    showToast("Failed to sync pipeline status", "error");
                    fetchLeads(); // Revert on failure
                }
            } catch (e) {
                showToast("Network error syncing status", "error");
                fetchLeads();
            }
        }
    };

    if (loading && leads.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-12 w-12 text-teal-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-white overflow-hidden">
            <ConfirmModal
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Remove Lead?"
                description="Permanently remove this lead from the pipeline."
                confirmText="Remove"
                cancelText="Keep"
                variant="destructive"
            />

            <header className="flex flex-col sm:flex-row items-center justify-between px-2 pt-2 gap-2 sm:gap-0">
                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-white border-2 border-teal-100 flex items-center justify-center shadow-md">
                        <Layout className="h-5 w-5 sm:h-6 sm:w-6 text-teal-500 stroke-[2.5]" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-black text-zinc-900 tracking-tight italic leading-none">Pipeline Console</h1>
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mt-1.5 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Operational Throughput Monitor
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button onClick={fetchLeads} className={cn("p-3 bg-white hover:bg-zinc-50 text-zinc-400 rounded-xl border border-zinc-200 transition-all hover:text-teal-600 shadow-sm", loading && "animate-spin text-teal-600")}>
                        <Zap className="h-4 w-4" />
                    </button>
                    <button onClick={() => router.push("/contacts/import")} className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 transition-all shadow-md active:scale-95">
                        <Plus className="h-4 w-4 stroke-[3]" /> Inject Lead
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-x-auto custom-scrollbar pb-6 text-black">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDragEnd={onDragEnd}
                >
                    <div className="flex gap-6 h-full min-w-max pb-4 px-2">
                        {pipelines.map(stage => (
                            <PipelineColumn
                                key={stage.status}
                                stage={stage}
                                leads={leads.filter(l => l.status === stage.status)}
                                onDial={handleDial}
                                onDelete={handleDeleteClick}
                            />
                        ))}
                    </div>

                    <DragOverlay>
                        {activeLead ? (
                            <div className="w-[300px]">
                                <SortableLeadCard
                                    lead={activeLead}
                                    color={pipelines.find(p => p.status === activeLead.status)?.color || 'zinc'}
                                    onDial={() => { }}
                                    onDelete={() => { }}
                                    isOverlay
                                />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    );
}
