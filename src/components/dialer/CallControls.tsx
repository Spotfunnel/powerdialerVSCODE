import { CallStatus } from '@/types/dialer';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, Zap, CassetteTape } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlowOrb } from '@/components/effects/GlowOrb';

interface CallControlsProps {
    status: CallStatus;
    duration: number;
    isMuted: boolean;
    isOnHold: boolean;
    onDial: () => void;
    onEnd: () => void;
    onToggleMute: () => void;
    onToggleHold: () => void;
    onVmDrop?: () => void;
    isAutoDialEnabled?: boolean;
    onToggleAutoDial?: () => void;
}

const statusLabels: Record<CallStatus, string> = {
    idle: 'Ready to dial',
    ringing: 'Ringing...',
    connected: 'Connected',
    voicemail: 'Voicemail',
    ended: 'Call ended',
};

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function CallControls({
    status,
    duration,
    isMuted,
    isOnHold,
    onDial,
    onEnd,
    onToggleMute,
    onToggleHold,
    onVmDrop,
    isAutoDialEnabled,
    onToggleAutoDial,
}: CallControlsProps) {
    const isCallActive = status === 'ringing' || status === 'connected';
    const isVmDropAvailable = status === 'connected';

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-background relative overflow-hidden text-foreground">
            {/* Epic background glow orb */}
            <GlowOrb status={status} />

            {/* Subtle grid pattern */}
            <div
                className="absolute inset-0 opacity-[0.015] pointer-events-none"
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                    backgroundSize: '24px 24px',
                }}
            />

            {/* Status Indicator */}
            <div className="text-center mb-10 relative z-10">
                <div
                    className={cn(
                        'text-sm font-semibold mb-3 tracking-wide uppercase transition-all duration-500',
                        status === 'idle' && 'text-muted-foreground',
                        status === 'ringing' && 'state-ringing animate-pulse',
                        status === 'connected' && 'state-connected',
                        status === 'voicemail' && 'state-voicemail',
                        status === 'ended' && 'text-muted-foreground'
                    )}
                >
                    <span className="inline-flex items-center gap-2">
                        {isCallActive && (
                            <span className={cn(
                                'w-2 h-2 rounded-full status-dot',
                                status === 'ringing' && 'bg-state-ringing',
                                status === 'connected' && 'bg-state-connected'
                            )} />
                        )}
                        {statusLabels[status]}
                    </span>
                </div>

                {/* Epic Timer */}
                {isCallActive && (
                    <div className={cn(
                        'text-6xl font-bold tabular-nums tracking-tight animate-scale-in font-mono',
                        status === 'connected' && 'gradient-text'
                    )}>
                        {formatDuration(duration)}
                    </div>
                )}

                {/* Ringing animation - concentric rings */}
                {status === 'ringing' && (
                    <div className="mt-8 flex justify-center animate-fade-in">
                        <div className="relative flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-state-ringing animate-pulse" />
                            {[...Array(3)].map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute w-4 h-4 rounded-full border-2 border-state-ringing animate-pulse-ring"
                                    style={{ animationDelay: `${i * 0.4}s` }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Connected - audio visualizer */}
                {status === 'connected' && (
                    <div className="mt-6 flex justify-center items-end gap-1 animate-fade-in h-8">
                        {[...Array(9)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1.5 bg-state-connected rounded-full audio-bar"
                                style={{
                                    height: `${8 + Math.random() * 24}px`,
                                    animationDelay: `${i * 0.1}s`,
                                    animationDuration: `${0.3 + Math.random() * 0.4}s`
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Main Call Button - EPIC version */}
            <div className="mb-10 relative z-10">
                {!isCallActive && status !== 'ended' ? (
                    <button
                        onClick={onDial}
                        className="h-24 w-24 rounded-full call-btn-idle flex items-center justify-center text-white focus:outline-none focus:ring-4 focus:ring-state-connected/30 focus:ring-offset-4 focus:ring-offset-background group cursor-pointer"
                    >
                        <Phone className="h-10 w-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
                        <span className="sr-only">Dial</span>
                    </button>
                ) : isCallActive ? (
                    <button
                        onClick={onEnd}
                        className={cn(
                            "h-24 w-24 rounded-full flex items-center justify-center text-white focus:outline-none focus:ring-4 focus:ring-offset-4 focus:ring-offset-background group cursor-pointer transition-colors duration-300",
                            status === 'ringing'
                                ? 'call-btn-ringing focus:ring-state-ringing/30'
                                : 'call-btn-end focus:ring-destructive/30'
                        )}
                    >
                        <PhoneOff className="h-10 w-10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" />
                        <span className="sr-only">End Call</span>
                    </button>
                ) : status === 'ended' ? (
                    <button
                        onClick={onEnd} // Re-using onEnd to "clear" or "next" effectively if needed, but logic usually handled by parent. 
                        // Actually usually 'ended' state waits for disposition.
                        // But we render nothing here or a 'reset' button.
                        // For now, let's just show disabled or nothing.
                        className="h-24 w-24 rounded-full bg-muted flex items-center justify-center text-muted-foreground cursor-not-allowed opacity-50"
                        disabled
                    >
                        <PhoneOff className="h-10 w-10 opacity-50" />
                    </button>
                ) : null}

                {/* Keyboard shortcut hint with animation */}
                {!isCallActive && status !== 'ended' && (
                    <div className="text-center mt-6 animate-slide-up-fade">
                        <p className="text-sm text-muted-foreground">
                            Press <span className="kbd mx-1 hover:scale-110 transition-transform">Space</span> to dial
                        </p>
                    </div>
                )}
            </div>

            {/* Secondary Controls - glassmorphism */}
            <div className="flex items-center gap-6 animate-fade-in-up relative z-10">
                {isCallActive && (
                    <>
                        <button
                            onClick={onToggleMute}
                            className={cn(
                                "h-14 w-14 rounded-full p-0 transition-all duration-300 glass flex items-center justify-center cursor-pointer",
                                isMuted ? "bg-destructive/20 border-destructive/50 text-destructive hover:bg-destructive/30 shadow-lg shadow-destructive/20" : "hover:bg-muted/50 text-foreground"
                            )}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? (
                                <MicOff className="h-6 w-6 animate-wiggle" />
                            ) : (
                                <Mic className="h-6 w-6" />
                            )}
                        </button>

                        <button
                            onClick={onToggleHold}
                            className={cn(
                                "h-14 w-14 rounded-full p-0 transition-all duration-300 glass flex items-center justify-center cursor-pointer",
                                isOnHold ? "bg-state-ringing/20 border-state-ringing/50 text-state-ringing hover:bg-state-ringing/30 shadow-lg shadow-state-ringing/20" : "hover:bg-muted/50 text-foreground"
                            )}
                            title={isOnHold ? 'Resume' : 'Hold'}
                        >
                            {isOnHold ? (
                                <Play className="h-6 w-6 animate-pulse" />
                            ) : (
                                <Pause className="h-6 w-6" />
                            )}
                        </button>

                        {isVmDropAvailable && (
                            <button
                                onClick={onVmDrop}
                                className="h-14 px-6 rounded-full flex items-center gap-2 transition-all duration-300 glass hover:bg-state-voicemail/20 text-state-voicemail border-state-voicemail/30 cursor-pointer shadow-lg shadow-state-voicemail/10"
                                title="Drop Voicemail"
                            >
                                <CassetteTape className="h-6 w-6" />
                                <span className="font-semibold uppercase tracking-wider text-xs">Drop VM</span>
                            </button>
                        )}
                    </>
                )}

                {/* Auto-Dial Toggle (Always visible in some form or only idle?) */}
                {!isCallActive && status !== 'ended' && (
                    <button
                        onClick={onToggleAutoDial}
                        className={cn(
                            "h-14 px-6 rounded-full flex items-center gap-2 transition-all duration-300 glass cursor-pointer border-dashed",
                            isAutoDialEnabled
                                ? "bg-primary/20 border-primary text-primary shadow-lg shadow-primary/20"
                                : "opacity-60 hover:opacity-100 grayscale hover:grayscale-0 text-muted-foreground"
                        )}
                    >
                        <Zap className={cn("h-5 w-5", isAutoDialEnabled && "animate-pulse")} />
                        <span className="font-semibold uppercase tracking-wider text-xs">
                            Cruise Control: {isAutoDialEnabled ? 'ON' : 'OFF'}
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
