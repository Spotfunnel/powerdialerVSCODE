"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Save, AlertCircle } from "lucide-react";

interface EditContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: any;
    onSave: (updatedData: any) => Promise<void>;
}

export function EditContactModal({ isOpen, onClose, lead, onSave }: EditContactModalProps) {
    const [formData, setFormData] = useState({
        companyName: lead?.companyName || "",
        firstName: lead?.firstName || "",
        lastName: lead?.lastName || "",
        email: lead?.email || "",
        phoneNumber: lead?.phoneNumber || "",
        suburb: lead?.suburb || "",
        state: lead?.state || "",
        industry: lead?.industry || ""
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync state when lead prop changes
    useEffect(() => {
        if (lead && isOpen) {
            setFormData(prev => ({
                ...prev,
                companyName: lead.companyName || "",
                firstName: lead.firstName || "",
                lastName: lead.lastName || "",
                email: lead.email || "",
                phoneNumber: lead.phoneNumber || "", // If lead has no phone, it's empty.
                suburb: lead.suburb || "",
                state: lead.state || "",
                industry: lead.industry || ""
            }));
            setError(null);
        }
    }, [lead, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!formData.phoneNumber) {
                setError("Phone Number is required for dialing protocols.");
                setLoading(false);
                return;
            }
            await onSave(formData);
            onClose();
        } catch (err: any) {
            console.error("Failed to save", err);
            setError(err.message || "Failed to save contact");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-zinc-200">
                <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
                    <h2 className="text-xl font-black text-zinc-900 tracking-tight italic">
                        {lead?.id ? "Edit Contact" : "Add New Contact"}
                    </h2>

                    <button type="button" onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                        <X className="h-5 w-5 text-zinc-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-xs font-bold animate-in slide-in-from-top-2">
                            <AlertCircle className="h-4 w-4" />
                            {error}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Company</label>
                            <input
                                value={formData.companyName}
                                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Industry</label>
                            <input
                                value={formData.industry}
                                onChange={e => setFormData({ ...formData, industry: e.target.value })}
                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">First Name</label>
                            <input
                                value={formData.firstName}
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Last Name</label>
                            <input
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest text-teal-600">Phone Number (Required)</label>
                        <input
                            required
                            value={formData.phoneNumber}
                            onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all required:border-teal-500/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Email</label>
                        <input
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Suburb</label>
                            <input
                                value={formData.suburb}
                                onChange={e => setFormData({ ...formData, suburb: e.target.value })}
                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">State</label>
                            <input
                                value={formData.state}
                                onChange={e => setFormData({ ...formData, state: e.target.value })}
                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 bg-white border border-zinc-200 text-zinc-500 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-teal-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-teal-500 transition-all shadow-lg shadow-teal-600/20 flex items-center gap-2 disabled:opacity-70"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            <Save className="h-4 w-4" />
                            Save Contact
                        </button>
                    </div>
                </form>
            </div>
        </div >
    );
}
