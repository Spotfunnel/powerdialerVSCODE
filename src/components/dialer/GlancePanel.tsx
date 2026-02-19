"use client";

import { useLead } from "@/contexts/LeadContext";
import { Globe, MapPin, Building2, ExternalLink, CheckCircle } from "lucide-react";

export function GlancePanel() {
    const { currentLead, loading } = useLead();

    if (loading) {
        return (
            <div className="p-6 space-y-4 animate-pulse w-full max-w-md">
                <div className="h-8 w-1/2 bg-zinc-100 rounded-lg" />
                <div className="h-4 w-3/4 bg-zinc-100 rounded" />
                <div className="h-4 w-1/3 bg-zinc-100 rounded" />
            </div>
        );
    }

    if (!currentLead) {
        return (
            <div className="p-6 text-center bg-muted/30 border-b border-border">
                <h2 className="text-xl font-bold text-foreground">Queue Empty</h2>
            </div>
        );
    }

    return (
        <div className="w-full max-w-lg p-6 bg-background/50 backdrop-blur-sm border-b-2 border-r-2 border-zinc-200 rounded-br-2xl relative overflow-hidden">
            <div className="flex flex-col gap-3 relative z-10">
                {/* Identity Header */}
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                        <Building2 className="h-3 w-3" />
                        {currentLead.companyName}
                    </div>
                    <div className="flex items-baseline gap-3">
                        <h1 className="text-2xl font-black tracking-tight text-foreground">
                            {currentLead.firstName} {currentLead.lastName}
                        </h1>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                            LEAD
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                        {currentLead.description || "No description available."}
                    </p>
                </div>

                {/* Dense Meta Grid */}
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                    {/* Address / Location */}
                    <div className="flex items-center gap-2 text-zinc-600 col-span-2">
                        <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                        {currentLead.address ? (
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentLead.address + (currentLead.suburb ? ', ' + currentLead.suburb : '') + (currentLead.state ? ', ' + currentLead.state : ''))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary transition-colors truncate"
                            >
                                {currentLead.address}
                                {currentLead.suburb && <span className="font-bold ml-1">({currentLead.suburb})</span>}
                            </a>
                        ) : (
                            <span>{currentLead.location || currentLead.suburb || "Unknown Location"}</span>
                        )}
                    </div>

                    {/* Suburb -> Website (as requested) */}
                    {currentLead.suburb && currentLead.website && (
                        <div className="flex items-center gap-2 text-zinc-600">
                            <Globe className="h-3.5 w-3.5 text-zinc-400" />
                            <a
                                href={currentLead.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-primary hover:underline"
                            >
                                {currentLead.suburb}
                            </a>
                        </div>
                    )}

                    {!currentLead.suburb && currentLead.website && (
                        <a href={currentLead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                            <Globe className="h-3.5 w-3.5" />
                            {currentLead.website.replace(/^https?:\/\//, '')}
                        </a>
                    )}

                    <div className="flex items-center gap-2 text-zinc-600">
                        <CheckCircle className="h-3.5 w-3.5 text-zinc-400" />
                        {currentLead.industry || "Unknown Industry"}
                    </div>
                </div>
            </div>
        </div>
    );
}
