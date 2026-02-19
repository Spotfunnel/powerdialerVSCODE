export type CallStatus = 'idle' | 'ringing' | 'connected' | 'voicemail' | 'ended';

export type CallOutcome = 'no_answer' | 'voicemail' | 'not_interested' | 'interested' | 'booked_demo' | 'callback' | 'bad_number';

export interface Lead {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    companyName: string;
    phoneNumber: string;
    description?: string | null;
    website?: string | null;
    email?: string | null;
    address?: string | null;
    industry?: string | null;
    location?: string | null;
    suburb?: string | null;
    state?: string | null;
    status: string;
    attempts: number;
    lastCalledAt?: Date | string | null;
    notes?: string;
    campaignId?: string | null;
}
