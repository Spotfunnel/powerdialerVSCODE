"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Phone,
    Layout,
    Users,
    Calendar,
    Trophy,
    Mic2,
    Clock,
    Settings,
    LogOut,
    Menu,
    X,
    ScrollText,
    MessageSquare,
    User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
    { label: "Dialer", href: "/dialer", icon: Phone },
    { label: "Messaging", href: "/messaging", icon: MessageSquare },
    { label: "Inbound", href: "/inbound", icon: Mic2 },
    { label: "Callbacks", href: "/callbacks", icon: Clock },
    { label: "History", href: "/history", icon: ScrollText },
    { label: "Pipeline", href: "/pipeline", icon: Layout },
    { label: "Contacts", href: "/contacts", icon: Users },
    { label: "Calendar", href: "/calendar", icon: Calendar },
    { label: "KPIs", href: "/kpi", icon: Trophy },
];


export function Sidebar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    const handleLogout = () => {
        signOut({ callbackUrl: "/login" });
    };

    return (
        <>
            {/* Mobile Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex lg:hidden fixed top-4 right-4 z-[100] h-12 w-12 rounded-xl bg-white border border-zinc-200 shadow-xl items-center justify-center text-black active:scale-90 transition-all"
            >
                {isOpen ? <X className="h-6 w-6 stroke-[2.5]" /> : <Menu className="h-6 w-6 stroke-[2.5]" />}
            </button>

            {/* Sidebar Component */}
            <aside className={cn(
                "fixed inset-y-0 left-0 lg:static w-72 bg-white border-r border-zinc-100 flex flex-col p-6 z-[90] transition-all duration-300 lg:flex hidden",
                isOpen ? "translate-x-0 shadow-2xl flex" : "-translate-x-full lg:translate-x-0"
            )}>
                {/* Logo Section */}
                <div className="mb-10 flex items-center gap-4 px-2">
                    <div className="h-10 w-10 rounded-xl bg-black flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-xl tracking-tighter">S</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-black tracking-tight leading-none">SpotFunnel</h1>
                        <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mt-1">Console v2.1</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1.5">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsOpen(false)}
                                className={cn(
                                    "flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-bold text-sm group",
                                    isActive
                                        ? "bg-teal-50 text-teal-700 shadow-sm border border-teal-100"
                                        : "text-zinc-500 hover:text-black hover:bg-zinc-50"
                                )}
                            >
                                <item.icon className={cn(
                                    "h-5 w-5 transition-colors stroke-[2.5]",
                                    isActive ? "text-teal-600" : "text-zinc-400 group-hover:text-black"
                                )} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer Items */}
                <div className="border-t border-zinc-100 mt-6 pt-6 space-y-1.5">
                    <Link
                        href="/profile"
                        onClick={() => setIsOpen(false)}
                        className={cn(
                            "flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-bold text-sm group",
                            pathname === "/profile"
                                ? "bg-teal-50 text-teal-700 border border-teal-100"
                                : "text-zinc-500 hover:text-black hover:bg-zinc-50"
                        )}
                    >
                        <User className="h-5 w-5 text-zinc-400 group-hover:text-black transition-colors stroke-[2.5]" />
                        <span>Profile</span>
                    </Link>
                    <Link
                        href="/admin"
                        onClick={() => setIsOpen(false)}
                        className={cn(
                            "flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-bold text-sm group",
                            pathname === "/admin"
                                ? "bg-teal-50 text-teal-700 border border-teal-100"
                                : "text-zinc-500 hover:text-black hover:bg-zinc-50"
                        )}
                    >
                        <Settings className="h-5 w-5 text-zinc-400 group-hover:text-black transition-colors stroke-[2.5]" />
                        <span>Settings</span>
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-4 px-4 py-4 rounded-2xl text-zinc-500 hover:text-red-700 hover:bg-red-50 transition-all w-full text-left font-bold text-sm group"
                    >
                        <LogOut className="h-5 w-5 text-zinc-400 group-hover:text-red-600 transition-colors stroke-[2.5]" />
                        <span>Log out</span>
                    </button>
                </div>
            </aside>

            {/* Backdrop for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80] lg:hidden animate-in fade-in duration-300"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
