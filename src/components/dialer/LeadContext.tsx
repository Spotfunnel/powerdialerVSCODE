import { Lead } from '@/types/dialer';
import { MapPin, Phone, Zap, Clock, RotateCcw, Globe, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadContextProps {
    lead: Lead;
}

export function LeadContext({ lead }: LeadContextProps) {
    const priority = lead.attempts === 0 ? 'A' : 'B';
    const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');

    return (
        <div className="h-full flex flex-col p-6 bg-card border-r-2 border-zinc-200 relative overflow-hidden">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-muted/30 pointer-events-none" />

            <div className="space-y-5 relative z-10">
                {/* Priority Badge with glow */}
                <div className="flex items-center gap-2 animate-slide-in-left">
                    <div
                        className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                            'transition-all duration-300 hover:scale-105',
                            priority === 'A' ? 'priority-a' : 'priority-b'
                        )}
                    >
                        {priority === 'A' && <Zap className="h-3 w-3 mr-1 animate-pulse" />}
                        Priority {priority}
                    </div>
                </div>

                {/* Company Name - HERO treatment */}
                <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <h2 className="text-2xl font-bold leading-tight tracking-tight">
                        {lead.companyName}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1.5 font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {fullName || 'Unknown Contact'}
                    </p>
                </div>

                {/* Contact Info - Interactive cards */}
                <div className="space-y-3 animate-fade-in" style={{ animationDelay: '200ms' }}>

                    {/* Phone Card */}
                    <div className="flex items-center gap-3 p-3 rounded-lg glass transition-all duration-300 hover:scale-[1.02] hover:shadow-md group cursor-pointer">
                        <div className="h-9 w-9 rounded-full bg-state-connected/10 flex items-center justify-center group-hover:bg-state-connected/20 transition-colors">
                            <Phone className="h-4 w-4 text-state-connected" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Phone</p>
                            <p className="font-semibold font-mono tracking-wide">{lead.phoneNumber}</p>
                        </div>
                    </div>

                    {/* Website Card (New Feature) */}
                    {lead.website && (
                        <a
                            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 transition-all duration-300 hover:bg-muted group cursor-pointer hover:border-primary/20 border border-transparent"
                        >
                            <div className="h-9 w-9 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                <Globe className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">Website</p>
                                <p className="font-medium truncate text-blue-600 hover:underline">{lead.website}</p>
                            </div>
                        </a>
                    )}

                </div>

                {/* Attempt Count - visual stats */}
                <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '300ms' }}>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                        <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold">{lead.attempts}</span>
                        <span className="text-xs text-muted-foreground">
                            attempt{lead.attempts !== 1 ? 's' : ''}
                        </span>
                    </div>
                    {lead.lastCalledAt && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                                {new Date(lead.lastCalledAt).toLocaleDateString()}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Notes - improved styling */}
            <div className="mt-6 flex-1 min-h-0 relative z-10 animate-fade-in" style={{ animationDelay: '400ms' }}>
                <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        About / Description
                    </p>
                    <div className="flex-1 h-px bg-border" />
                </div>
                <div className="h-[calc(100%-28px)] overflow-y-auto pr-2">
                    {lead.description ? (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {lead.description}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground/50 italic">
                            No description available
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
