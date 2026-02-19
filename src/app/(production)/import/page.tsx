"use client";

import { useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function ImportPage() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'uploading'>('idle');
    const [message, setMessage] = useState("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setMessage("");
            setProgress(0);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setStatus('uploading');
        setProgress(0);
        setMessage("Preparing file...");

        try {
            const text = await file.text();
            // Split and clean empty rows
            const allRows = text.split("\n").map(r => r.trim()).filter(r => r !== "");

            if (allRows.length < 2) {
                throw new Error("CSV file is empty or invalid.");
            }

            const header = allRows[0];
            const dataRows = allRows.slice(1);
            const BATCH_SIZE = 500;
            const totalBatches = Math.ceil(dataRows.length / BATCH_SIZE);

            let successes = 0;

            for (let i = 0; i < totalBatches; i++) {
                const batchRows = dataRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
                // Prepend header so backend can map columns correctly
                const payloadRows = [header, ...batchRows];

                setMessage(`Importing batch ${i + 1} of ${totalBatches}...`);

                const res = await fetch("/api/crm/import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rows: payloadRows }),
                });

                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error || `Failed on batch ${i + 1}`);
                }

                const result = await res.json();
                successes += (result.count || 0);

                // Update progress
                setProgress(Math.round(((i + 1) / totalBatches) * 100));
            }

            setStatus('success');
            setMessage(`Successfully imported ${successes} leads.`);
            setTimeout(() => router.push('/contacts'), 2000);

        } catch (e: any) {
            console.error(e);
            setStatus('error');
            setMessage(e.message || "An error occurred during upload.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-black text-zinc-900 mb-8 tracking-tighter">Import Leads</h1>

            <div className="bg-white rounded-3xl p-10 border border-zinc-200 shadow-xl text-center">
                <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Upload className="h-8 w-8 text-teal-600" />
                </div>

                <h2 className="text-xl font-bold text-zinc-800 mb-2">Upload CSV File</h2>
                <p className="text-zinc-500 text-sm mb-8">
                    Your CSV should have columns for Name, Phone, Company, Suburb, State, etc.
                </p>

                <div className="relative mb-8">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-full border-2 border-dashed border-zinc-200 rounded-2xl p-8 hover:bg-zinc-50 transition-colors flex flex-col items-center justify-center">
                        {file ? (
                            <div className="flex items-center gap-3 text-teal-700 font-bold">
                                <FileText className="h-5 w-5" />
                                {file.name}
                            </div>
                        ) : (
                            <span className="text-zinc-400 font-medium">Click or Drag to Upload CSV</span>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                {status === 'uploading' && (
                    <div className="w-full bg-zinc-100 rounded-full h-2.5 mb-6 overflow-hidden">
                        <div
                            className="bg-teal-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3 mb-6 font-bold text-sm">
                        <AlertCircle className="h-5 w-5" />
                        {message}
                    </div>
                )}

                {(status === 'success' || (status === 'uploading' && message)) && (
                    <div className={cn(
                        "p-4 rounded-xl flex items-center gap-3 mb-6 font-bold text-sm",
                        status === 'success' ? "bg-teal-50 text-teal-700" : "bg-zinc-50 text-zinc-600"
                    )}>
                        {status === 'success' ? <CheckCircle className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
                        {message}
                    </div>
                )}

                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => router.back()}
                        className="px-6 py-3 bg-white border border-zinc-200 text-zinc-500 rounded-xl font-bold hover:bg-zinc-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="px-8 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {progress}%
                            </>
                        ) : "Start Import"}
                    </button>
                </div>
            </div>
        </div>
    );
}
