"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NotificationType = 'success' | 'error' | 'info' | 'call' | 'sms';

interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface NotificationContextType {
    addNotification: (notification: Omit<Notification, 'id'>) => void;
    removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotification must be used within a NotificationProvider');
    return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newNotification = { ...notification, id };

        setNotifications((prev) => [...prev, newNotification]);

        if (notification.type !== 'call' && notification.duration !== 0) {
            const timer = setTimeout(() => {
                removeNotification(id);
            }, notification.duration || 5000);
            return () => clearTimeout(timer);
        }
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ addNotification, removeNotification }}>
            {children}
            <NotificationStack notifications={notifications} onRemove={removeNotification} />
        </NotificationContext.Provider>
    );
}

function NotificationStack({ notifications, onRemove }: { notifications: Notification[], onRemove: (id: string) => void }) {
    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex flex-col items-center gap-3 w-full max-w-md px-4 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {notifications.map((n) => (
                    <motion.div
                        key={n.id}
                        layout
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        className="pointer-events-auto"
                    >
                        <NotificationBanner notification={n} onRemove={() => onRemove(n.id)} />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

function NotificationBanner({ notification, onRemove }: { notification: Notification, onRemove: () => void }) {
    const { type, title, message, action } = notification;

    const icons = {
        success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
        error: <AlertCircle className="h-5 w-5 text-red-500" />,
        info: <Info className="h-5 w-5 text-blue-500" />,
        call: <Bell className="h-5 w-5 text-teal-600 animate-ring" />,
        sms: <Bell className="h-5 w-5 text-teal-600" />,
    };

    const bgColors = {
        success: 'bg-emerald-50/90 border-emerald-100',
        error: 'bg-red-50/90 border-red-100',
        info: 'bg-blue-50/90 border-blue-100',
        call: 'bg-white/95 border-teal-200 shadow-xl ring-2 ring-teal-500/10',
        sms: 'bg-white/95 border-teal-100 shadow-lg',
    };

    return (
        <div className={cn(
            "flex items-start gap-4 p-4 rounded-2xl border backdrop-blur-xl transition-all",
            bgColors[type]
        )}>
            <div className="flex-shrink-0 mt-0.5">
                {icons[type]}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-zinc-900 leading-tight">
                    {title}
                </p>
                <p className="text-xs font-bold text-zinc-500 mt-0.5 line-clamp-2">
                    {message}
                </p>
                {action && (
                    <button
                        onClick={action.onClick}
                        className="mt-3 px-4 py-1.5 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                        {action.label}
                    </button>
                )}
            </div>
            <button
                onClick={onRemove}
                className="flex-shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
                <X className="h-4 w-4 stroke-[3]" />
            </button>
        </div>
    );
}
