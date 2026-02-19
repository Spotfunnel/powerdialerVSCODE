"use client";

import { useState, useEffect } from "react";
import {
    Users,
    Search,
    Plus,
    Building2,
    CheckCircle2,
    Phone,
    FileText,
    ShieldCheck,
    AlertCircle,
    Briefcase,
    Calendar,
    MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useLead } from "@/contexts/LeadContext";
import { EditContactModal } from "@/components/contacts/EditContactModal";
import { PipelineWizard } from "@/components/contacts/PipelineWizard";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/contexts/ToastContext";
import { ContactRow } from "@/components/contacts/ContactRow";
import { ContactCard } from "@/components/contacts/ContactCard";
import { useCallback } from "react";

export default function ContactsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("READY");
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const [totalLeads, setTotalLeads] = useState(0);
    const [page, setPage] = useState(1);
    const [editingLead, setEditingLead] = useState<any | null>(null);
    const pageSize = 50;
    const { showToast } = useToast();

    // Confirm States
    const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
    const [dedupConfirmOpen, setDedupConfirmOpen] = useState(false);

    const [columns, setColumns] = useState([
        { id: 'companyName', label: 'Contact', visible: true, width: '25%' },
        { id: 'location', label: 'Location', visible: true, width: '15%' },
        { id: 'status', label: 'Status', visible: true, width: '10%' },
        { id: 'industry', label: 'Industry', visible: true, width: '15%' },
        { id: 'activity', label: 'Activity', visible: true, width: '15%' },
        { id: 'actions', label: 'Action', visible: true, width: '20%' },
        // Hidden by default optional columns
        { id: 'email', label: 'Email', visible: false, width: '15%' },
        { id: 'phone', label: 'Phone', visible: false, width: '15%' },
        { id: 'employees', label: 'Employees', visible: false, width: '10%' },
    ]);
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    const [sortBy, setSortBy] = useState("createdAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: pageSize.toString(),
                q: searchTerm,
                sortBy,
                sortOrder
            });
            params.append("status", statusFilter);
            const baseUrl = window.location.origin;
            const res = await fetch(`${baseUrl}/api/crm/contacts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLeads(data.leads || []);
                setTotalLeads(data.total);
            }
        } catch (error) {
            console.error("Failed to fetch leads", error);
            showToast("Failed to connect to repository", 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, [page, statusFilter, sortBy, sortOrder]);

    const [wizardState, setWizardState] = useState<{ isOpen: boolean; leadId: string; companyName: string } | null>(null);

    const handleSort = (columnId: string) => {
        if (columnId === 'actions' || columnId === 'activity' || columnId === 'industry') return; // Skip non-sortable

        if (sortBy === columnId) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(columnId);
            setSortOrder('asc');
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (page === 1) {
                fetchLeads();
            } else {
                setPage(1);
            }
        }, 450);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleContactClick = useCallback((leadId: string) => {
        router.push(`/dialer?leadId=${leadId}`);
    }, [router]);

    const handleMessageClick = useCallback((leadId: string) => {
        router.push(`/dialer?leadId=${leadId}&tab=messaging`);
    }, [router]);

    const handleWizardClick = useCallback((lead: any) => {
        setWizardState({ isOpen: true, leadId: lead.id, companyName: lead.companyName || 'Lead' });
    }, []);

    const handleEditClick = (e: React.MouseEvent, lead: any) => {
        e.stopPropagation();
        setEditingLead(lead);
    };

    // Note: handlePipelineMove logic moved to PipelineWizard component

    const handleDeleteClick = (e: React.MouseEvent, leadId: string) => {
        e.stopPropagation();
        setLeadToDelete(leadId); // Opens Confirm Modal
    };

    const handleConfirmDelete = async () => {
        if (!leadToDelete) return;

        // Optimistic Update
        const previousLeads = [...leads];
        setLeads(current => current.filter(l => l.id !== leadToDelete));
        showToast("Lead removing...", 'info');

        try {
            const res = await fetch(`/api/crm/contacts/${leadToDelete}`, {
                method: "DELETE"
            });
            if (res.ok) {
                showToast("Contact permanently deleted", 'success');
                // No need to fetchLeads if successful, state is already updated
            } else {
                // Revert
                setLeads(previousLeads);
                showToast("Failed to delete contact", 'error');
            }
        } catch (error) {
            console.error("Failed to delete contact", error);
            setLeads(previousLeads);
            showToast("Failed to delete contact", 'error');
        } finally {
            setLeadToDelete(null);
        }
    };

    const handleDedupe = async () => {
        showToast("Starting analysis...", 'info');
        try {
            const res = await fetch("/api/crm/dedup", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                showToast(`Cleanup Complete! deleted ${data.deleted} duplicates`, 'success');
                fetchLeads();
            } else {
                showToast("Error: " + data.error, 'error');
            }
        } catch (e) {
            showToast("Failed to run cleanup", 'error');
        } finally {
            setDedupConfirmOpen(false);
        }
    };

    const handleSaveContact = async (updatedData: any) => {
        showToast("Saving...", 'info');
        try {
            const isNew = !editingLead?.id;
            const url = isNew ? "/api/crm/contacts" : `/api/crm/contacts/${editingLead.id}`;
            const method = isNew ? "POST" : "PATCH";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedData)
            });
            if (res.ok) {
                setEditingLead(null);
                showToast(`Contact ${isNew ? 'created' : 'updated'} successfully`, 'success');
                if (isNew) setPage(1); // Go to first page to see the new lead
                fetchLeads();
            } else {
                const data = await res.json();
                showToast(data.error || "Failed to save contact", 'error');
            }
        } catch (error) {
            console.error("Failed to save contact", error);
            showToast("Network error saving contact", 'error');
        }
    };

    const handleExportCSV = () => {
        const headers = columns.filter(c => c.visible).map(c => c.label).join(",");
        const rows = leads.map(l => {
            return columns.filter(c => c.visible).map(c => {
                if (c.id === 'companyName') return `"${l.companyName || ''}"`;
                if (c.id === 'location') return `"${(l.suburb || '')} ${(l.state || '')}"`;
                if (c.id === 'status') return l.status;
                return `"${l[c.id] || ''}"`;
            }).join(",");
        });
        const csvContent = [headers, ...rows].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads-${new Date().toISOString()}.csv`;
        a.click();
    };

    return (
        <div className="w-full h-full flex flex-col bg-white overflow-hidden relative">

            {/* Header / Stats Bar */}
            <div className="px-4 sm:px-6 py-4 sm:py-6 border-b border-zinc-100 flex flex-wrap items-center justify-between bg-white shrink-0 gap-3 sm:gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-[1rem] bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-600/20">
                        <Users className="h-6 w-6 text-white stroke-[2.5]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-black italic tracking-tight leading-none">Contacts</h1>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                            CRM Lead Repository
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                    <div className="relative w-full sm:w-72 order-last sm:order-first mt-2 sm:mt-0">
                        {loading ? (
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 stroke-[2.5]" />
                        )}
                        <input
                            type="text"
                            placeholder="Search identities..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-[11px] font-black tracking-widest focus:border-teal-500/30 outline-none transition-all placeholder:text-zinc-300"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setDedupConfirmOpen(true)}
                            className="h-10 sm:h-12 px-3 sm:px-6 bg-white border-2 border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50 text-zinc-500 hover:text-zinc-900 rounded-xl sm:rounded-2xl text-[10px] font-black tracking-[0.2em] flex items-center gap-2 sm:gap-3 transition-all active:scale-95 shadow-sm"
                        >
                            <ShieldCheck className="h-4 w-4 stroke-[2.5]" />
                            <span className="hidden sm:inline">Dedupe</span>
                        </button>
                        <button
                            onClick={() => setEditingLead({})}
                            className="h-10 sm:h-12 px-3 sm:px-6 bg-white border-2 border-zinc-900 hover:bg-zinc-50 text-zinc-900 rounded-xl sm:rounded-2xl text-[10px] font-black tracking-[0.2em] flex items-center gap-2 sm:gap-3 transition-all active:scale-95 shadow-sm"
                        >
                            <Plus className="h-4 w-4 stroke-[3]" />
                            <span className="hidden sm:inline">New</span>
                        </button>
                        <button
                            onClick={() => router.push('/contacts/import')}
                            className="h-10 sm:h-12 px-3 sm:px-6 bg-teal-600 hover:bg-teal-700 text-white rounded-xl sm:rounded-2xl text-[10px] font-black tracking-[0.2em] flex items-center gap-2 sm:gap-3 transition-all shadow-lg active:scale-95 border-b-4 border-teal-800"
                        >
                            <FileText className="h-4 w-4 stroke-[2.5]" />
                            <span className="hidden sm:inline">Import</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Data Plane - Clean Table or Grid */}
            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-white -webkit-overflow-scrolling-touch">
                {/* Desktop View: Wide Table */}
                <table className="w-full border-collapse table-fixed min-w-[900px] hidden lg:table" style={{ touchAction: 'pan-x pan-y' }}>
                    <thead className="sticky top-0 bg-white border-b border-zinc-100 z-10 shadow-sm">
                        <tr>
                            {columns.filter(c => c.visible).map(col => (
                                <th
                                    key={col.id}
                                    onClick={() => handleSort(col.id)}
                                    style={{ width: (col as any).width }}
                                    className={cn(
                                        "px-4 py-3 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest cursor-pointer hover:text-teal-600 transition-colors select-none",
                                        col.id === 'actions' && "text-right cursor-default hover:text-zinc-400",
                                        sortBy === col.id && "text-teal-600"
                                    )}>
                                    <div className={cn("flex items-center gap-1", col.id === 'actions' && "justify-end")}>
                                        {col.label}
                                        {sortBy === col.id && (
                                            <span className="text-[9px]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {loading && leads.length === 0 ? (
                            <tr>
                                <td colSpan={columns.filter(c => c.visible).length} className="px-4 py-12 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Loading Repository...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : leads.map((lead) => (
                            <ContactRow
                                key={lead.id}
                                lead={lead}
                                columns={columns}
                                onContactClick={handleContactClick}
                                onWizardClick={handleWizardClick}
                                onMessageClick={handleMessageClick}
                            />
                        ))}
                    </tbody>
                </table>

                {/* Mobile View: Clean List Cards */}
                <div className="lg:hidden flex flex-col divide-y divide-zinc-50">
                    {loading && leads.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Loading Repository...</span>
                            </div>
                        </div>
                    ) : leads.map((lead) => (
                        <ContactCard
                            key={lead.id}
                            lead={lead}
                            onContactClick={handleContactClick}
                            onWizardClick={handleWizardClick}
                            onMessageClick={handleMessageClick}
                        />
                    ))}
                </div>
            </div>

            <footer className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    Showing {totalLeads === 0 ? 0 : Math.min((page - 1) * pageSize + 1, totalLeads)} - {Math.min(page * pageSize, totalLeads)} of {totalLeads}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px] font-black uppercase text-zinc-400 hover:text-zinc-600 disabled:opacity-30 transition-all"
                    >
                        Prev
                    </button>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={page * pageSize >= totalLeads}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-black uppercase shadow-md disabled:opacity-30 transition-all"
                    >
                        Next
                    </button>
                </div>
            </footer>

            <EditContactModal
                isOpen={!!editingLead}
                onClose={() => setEditingLead(null)}
                lead={editingLead}
                onSave={handleSaveContact}
            />
            {wizardState && (
                <PipelineWizard
                    isOpen={wizardState.isOpen}
                    onClose={() => setWizardState(null)}
                    leadId={wizardState.leadId}
                    companyName={wizardState.companyName}
                    onSuccess={() => {
                        showToast("Lead moved successfully!", 'success');
                        fetchLeads(); // Keeps sync but user already sees result via Wizard if we wanted to optmize logic inside wizard too
                    }}
                />
            )}

            {/* Global Confirm Modal for Deletion */}
            <ConfirmModal
                isOpen={!!leadToDelete}
                onClose={() => setLeadToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Contact"
                description="Are you sure you want to delete this contact? This action cannot be undone."
                confirmText="Delete"
                variant="destructive"
            />

            {/* Global Confirm Modal for Dedupe */}
            <ConfirmModal
                isOpen={dedupConfirmOpen}
                onClose={() => setDedupConfirmOpen(false)}
                onConfirm={handleDedupe}
                title="Run Deduplication?"
                description="This will analyze all contacts and remove duplicate phone numbers (keeping the oldest record). This cannot be undone."
                confirmText="Start Analysis"
                variant="default"
            />
        </div >
    );
}

