/**
 * Calendar Logic for SpotFunnel
 * DST-safe slot generation using IANA timezones.
 */

export interface TimeSlot {
    start: Date;
    end: Date;
    available: boolean;
    remainingSeats: number;
    isBookedByCurrentUser?: boolean;
    events?: any[];
}

/**
 * Returns the actual UTC offset (in hours, DST-aware) for a given IANA timezone at a specific date.
 */
function getTimeZoneOffsetHours(date: Date, timeZone: string): number {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset',
    });
    const parts = fmt.formatToParts(date);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+0';
    // Parses strings like "GMT+11", "GMT-5", "GMT+9:30"
    const match = tzName.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!match) return 0;
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = match[3] ? parseInt(match[3], 10) : 0;
    return sign * (hours + minutes / 60);
}

/**
 * Generates 30-min slots between startHour and endHour in the given IANA timezone.
 * DST-safe — computes the correct UTC offset for each day.
 *
 * Legacy name kept for backwards compatibility; pass timeZone to target any region.
 */
export function generateAESTSlots(
    baseDate: Date = new Date(),
    offset?: number,
    timeZone?: string,
    startHour = 9,
    endHour = 19,
): TimeSlot[] {
    // Prefer explicit IANA timezone; fall back to offset-based Sydney (legacy callers).
    const tz = timeZone ?? 'Australia/Sydney';
    const targetDate = new Date(baseDate);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const date = targetDate.getDate();

    // Compute DST-aware offset for this specific date in this zone.
    const dayNoon = new Date(Date.UTC(year, month, date, 12, 0, 0));
    const UTC_OFFSET = offset ?? getTimeZoneOffsetHours(dayNoon, tz);

    const slots: TimeSlot[] = [];
    for (let h = startHour; h < endHour; h++) {
        for (const mins of [0, 30]) {
            const utcStart = new Date(Date.UTC(year, month, date, h - UTC_OFFSET, mins, 0, 0));
            const utcEnd = new Date(utcStart.getTime() + 30 * 60 * 1000);
            slots.push({
                start: utcStart,
                end: utcEnd,
                available: true,
                remainingSeats: 2,
                events: [],
            });
        }
    }

    return slots;
}

export function calculateAvailability(
    baseSlots: TimeSlot[],
    googleEvents: any[],
    currentUser?: "Leo" | "Kye"
): TimeSlot[] {
    return baseSlots.map(slot => {
        let occupiedCount = 0;
        let isBookedByCurrentUser = false;
        const matchingEvents: any[] = [];

        const slotStart = new Date(slot.start).getTime();
        const slotEnd = new Date(slot.end).getTime();

        for (const event of googleEvents) {
            const eventStart = new Date(event.start.dateTime || event.start.date).getTime();
            const eventEnd = new Date(event.end.dateTime || event.end.date).getTime();

            // Check for overlap
            if (eventStart < slotEnd && eventEnd > slotStart) {
                occupiedCount++;

                // Detect if this event belongs to the current specialist focus
                const isUserEvent = currentUser && (
                    event.summary?.toLowerCase().includes(currentUser.toLowerCase()) ||
                    event.description?.toLowerCase().includes(currentUser.toLowerCase())
                );

                if (isUserEvent) {
                    isBookedByCurrentUser = true;
                    matchingEvents.push(event);
                }
            }
        }

        const remainingSeats = Math.max(0, 2 - occupiedCount);
        const isFull = remainingSeats === 0;

        // User View:
        // Available (1 seat) IF: Not full AND Not booked by me (for my view)
        // Note: We might want to show it as taken if ANYONE has it, but focus on the current specialist
        const userAvailable = !isFull && !isBookedByCurrentUser;

        return {
            ...slot,
            available: userAvailable,
            remainingSeats,
            isBookedByCurrentUser,
            events: matchingEvents
        };
    });
}


