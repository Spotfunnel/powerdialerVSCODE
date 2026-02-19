"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ToastProvider } from "@/contexts/ToastContext";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <SessionProvider>
            <NotificationProvider>
                <ToastProvider>
                    {children}
                </ToastProvider>
            </NotificationProvider>
        </SessionProvider>
    );
}
