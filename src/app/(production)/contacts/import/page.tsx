"use client";

import { useState } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function ImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<any>(null);

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setStatus(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/crm/import", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ success: true, count: data.count });
            } else {
                setStatus({ success: false, error: data.error });
            }
        } catch (e) {
            setStatus({ success: false, error: "Upload failed" });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-10 bg-muted/20">
            <div className="max-w-md w-full bg-card p-8 rounded-2xl border shadow-sm space-y-6">
                <div className="text-center space-y-2">
                    <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
                        <UploadCloud className="h-6 w-6 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold">Inject Leads</h1>
                    <p className="text-muted-foreground text-sm">
                        Upload a CSV to inject directly into the dial queue.
                        <br />
                        <span className="font-mono text-xs">Required: Phone, Company</span>
                    </p>
                </div>

                <div className="border-2 border-dashed border-border rounded-xl p-8 hover:bg-muted/50 transition-colors relative">
                    <input
                        type="file"
                        accept=".csv"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        {file ? (
                            <>
                                <FileSpreadsheet className="h-8 w-8 text-green-500" />
                                <span className="font-medium text-foreground">{file.name}</span>
                                <span className="text-xs">{(file.size / 1024).toFixed(1)} KB</span>
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="h-8 w-8" />
                                <span className="font-medium">Drag CSV here or click</span>
                            </>
                        )}
                    </div>
                </div>

                {status && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${status.success ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}`}>
                        {status.success ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                        <div className="text-sm font-medium">
                            {status.success ? `Successfully injected ${status.count} leads!` : status.error}
                        </div>
                    </div>
                )}

                <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="w-full py-3 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-all"
                >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run Injection"}
                </button>
            </div>
        </div>
    );
}
