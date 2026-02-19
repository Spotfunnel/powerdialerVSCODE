import { cn } from '@/lib/utils';
import { CallStatus } from '@/types/dialer';

interface GlowOrbProps {
    status: CallStatus;
    className?: string;
}

export function GlowOrb({ status, className }: GlowOrbProps) {
    const isActive = status === 'ringing' || status === 'connected';

    if (!isActive) return null;

    return (
        <div className={cn('absolute inset-0 pointer-events-none', className)}>
            {/* Primary glow */}
            <div
                className={cn(
                    'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-all duration-1000',
                    status === 'ringing' && 'w-64 h-64 bg-state-ringing/20 animate-pulse',
                    status === 'connected' && 'w-80 h-80 bg-state-connected/15 animate-glow-breathe'
                )}
            />

            {/* Secondary smaller orb */}
            <div
                className={cn(
                    'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl transition-all duration-700',
                    status === 'ringing' && 'w-32 h-32 bg-state-ringing/30 animate-pulse',
                    status === 'connected' && 'w-40 h-40 bg-state-connected/25 animate-glow-breathe'
                )}
                style={{ animationDelay: '0.5s' }}
            />
        </div>
    );
}
