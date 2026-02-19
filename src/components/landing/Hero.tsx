"use client";

import Link from "next/link";
import { ArrowRight, PhoneCall } from "lucide-react";

export function Hero() {
    return (
        <section className="relative overflow-hidden bg-background pt-16 pb-32">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">

                {/* Badge */}
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-8 backdrop-blur-sm">
                    <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
                    New: AI Voice Detection V2.0
                </div>

                {/* Headline */}
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground max-w-4xl mb-6 leading-tight">
                    The World's Fastest <span className="text-primary">Power Dialer</span>
                </h1>

                {/* Subhead */}
                <p className="text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
                    Automate your outbound sales with AI-driven workflows. Triple your connect rates
                    and crush your quota without the burnout.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <Link
                        href="/login"
                        className="px-8 py-4 bg-primary text-primary-foreground rounded-xl text-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
                    >
                        Start Your Free Trial
                        <ArrowRight className="h-5 w-5" />
                    </Link>
                    <Link
                        href="/login"
                        className="px-8 py-4 bg-card text-foreground border border-border rounded-xl text-lg font-bold hover:bg-muted transition-all flex items-center justify-center gap-2"
                    >
                        <PhoneCall className="h-5 w-5 text-muted-foreground" />
                        Watch Demo
                    </Link>
                </div>

                {/* Abstract Visual / Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            </div>
        </section>
    );
}
