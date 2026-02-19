"use client";

import { Zap, RefreshCcw, Voicemail } from "lucide-react";

const features = [
    {
        name: "Smart Queues",
        description: "AI prioritizes your hottest leads automatically so you always call the right person next.",
        icon: Zap,
    },
    {
        name: "Instant Data Sync",
        description: "Your data is instantly saved and available across your organization in real-time.",
        icon: RefreshCcw,
    },
    {
        name: "Voicemail Drop",
        description: "Leave pre-recorded voicemails with one click and move to the next call instantly.",
        icon: Voicemail,
    },
];

export function Features() {
    return (
        <section className="bg-muted/30 py-24 border-y border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {features.map((feature) => (
                        <div key={feature.name} className="flex flex-col items-start min-w-[200px]">
                            <div className="h-12 w-12 rounded-xl bg-background border border-border flex items-center justify-center shadow-sm mb-6">
                                <feature.icon className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-3">{feature.name}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
