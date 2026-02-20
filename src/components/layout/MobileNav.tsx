"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Phone,
    Inbox,
    Users,
    Trophy,
    History
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { label: "Contacts", href: "/contacts", icon: Users },
    { label: "Inbox", href: "/messaging", icon: Inbox },
    { label: "Dialer", href: "/dialer", icon: Phone },
    { label: "History", href: "/history", icon: History },
];

export function MobileNav() {
    const pathname = usePathname();

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 sm:h-20 bg-white/80 backdrop-blur-xl border-t border-zinc-100 flex items-center justify-around px-2 pb-safe z-50 shadow-[0_-1px_10px_rgba(0,0,0,0.02)]">
            {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const isDialer = item.label === "Dialer";

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex flex-col items-center justify-center w-full h-full gap-1 transition-all active:scale-90",
                            isActive ? "text-teal-600" : "text-zinc-400"
                        )}
                    >
                        <div className={cn(
                            "flex items-center justify-center transition-all",
                            isDialer ? "h-12 w-12 rounded-2xl bg-teal-600 text-white shadow-lg -translate-y-4" : "h-6 w-6"
                        )}>
                            <item.icon className={cn(
                                isDialer ? "h-6 w-6 stroke-[3]" : "h-5 w-5 stroke-[2.5]"
                            )} />
                        </div>
                        {!isDialer && (
                            <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
