'use client';

import { useState, useTransition } from 'react';
import { configureTwilioUrls } from '@/app/actions/twilio';
import { Loader2, Check, AlertCircle, Wand2 } from 'lucide-react';

export function AutoConfigureButton() {
    const [isPending, startTransition] = useTransition();
    const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

    const handleConfigure = () => {
        startTransition(async () => {
            const res = await configureTwilioUrls();
            setResult(res);
        });
    };

    return (
        <div className="flex flex-col items-start gap-2">
            <button
                onClick={handleConfigure}
                disabled={isPending}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors disabled:opacity-50"
            >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {isPending ? 'Configuring...' : 'Auto-Configure Twilio URLs'}
            </button>

            {result && (
                <div className={`text-sm p-3 rounded-md flex items-start gap-2 max-w-lg ${result.success ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {result.success ? <Check className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
                    <div>
                        <p className="font-semibold">{result.success ? 'Success' : 'Configuration Failed'}</p>
                        <p className="opacity-90">{result.message || result.error}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
