/**
 * Calendar Logic for SpotFunnel
 * Implements AEST Availability: 9 AM - 6 PM
 * Increments: 30 minutes
 */

export interface TimeSlot {
    start: Date;
    end: Date;
    available: boolean;
    remainingSeats: number;
    isBookedByCurrentUser?: boolean;
    events?: any[];
}

export function generateAESTSlots(baseDate: Date = new Date(), offset?: number): TimeSlot[] {
    // Australian Eastern Daylight Time (AEDT) is UTC+11
    // Standard (AEST) is UTC+10
    const UTC_OFFSET = offset ?? 11;

    const slots: TimeSlot[] = [];
    const startHour = 9;
    const endHour = 19; // Allows slots up to 6:30 PM - 7:00 PM

    // We want the calendar day of the baseDate in AEST
    // To be safe, we'll create a date object that represents that day in AEST
    const targetDate = new Date(baseDate);

    for (let h = startHour; h < endHour; h++) {
        for (const mins of [0, 30]) {
            // Stop at 6:30 PM AEST (18:30 start time)
            if (h === 18 && mins === 30) {
                // Determine if we want to include the 6:30-7:00 slot. 
                // "to 6:30" usually means 6:30 is the last end time or last start time.
                // If they say 6:30, let's include the 6:30-7:00 slot just in case.
            }
            // Create a date for the specific AEST time
            // We do this by taking the Y-M-D of baseDate and setting H:M
            const slotStart = new Date(targetDate);
            slotStart.setHours(h, mins, 0, 0);

            // Now, adjust for the fact that 'setHours' uses local time. 
            // We want this to be AEST 9AM. 
            // In Sydney right now it is AEDT (UTC+11).
            // A simpler way: construct it from UTC by subtracting the offset.
            const year = targetDate.getFullYear();
            const month = targetDate.getMonth();
            const date = targetDate.getDate();

            const utcStart = new Date(Date.UTC(year, month, date, h - UTC_OFFSET, mins, 0, 0));
            const utcEnd = new Date(utcStart.getTime() + 30 * 60 * 1000);

            slots.push({
                start: utcStart,
                end: utcEnd,
                available: true,
                remainingSeats: 2,
                events: []
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


