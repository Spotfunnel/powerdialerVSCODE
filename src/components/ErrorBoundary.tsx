"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
                    <div className="bg-white rounded-[2rem] p-8 shadow-2xl max-w-md w-full text-center border border-zinc-100">
                        <div className="h-16 w-16 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-6">
                            <AlertCircle className="h-8 w-8 text-red-500 stroke-[2.5]" />
                        </div>
                        <h2 className="text-2xl font-black text-zinc-900 mb-2">Something went wrong</h2>
                        <p className="text-zinc-500 mb-8 font-medium">
                            {this.state.error?.message || "An unexpected error occurred."}
                        </p>

                        {/* Debug Info */}
                        <div className="text-left bg-zinc-50 p-4 rounded-xl mb-6 overflow-auto max-h-48 text-[10px] font-mono text-zinc-600 border border-zinc-200">
                            <p className="font-bold mb-1">Error Details:</p>
                            {this.state.error?.toString()}
                            <br />
                            {this.state.error?.stack}
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-4 bg-zinc-900 hover:bg-black text-white rounded-xl font-bold uppercase tracking-widest transition-all active:scale-95"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
