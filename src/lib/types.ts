export const LeadStatus = {
    READY: "READY",
    LOCKED: "LOCKED",
    BOOKED: "BOOKED",
    SOLD: "SOLD",
    KEY_INFO_COLLECTED: "KEY_INFO_COLLECTED",
    ONBOARDED: "ONBOARDED",
    INTERESTED: "INTERESTED",
    CALLBACK: "CALLBACK",
    NO_ANSWER: "NO_ANSWER",
    NOT_INTERESTED: "NOT_INTERESTED",
    DQ: "DQ",
    ARCHIVED: "ARCHIVED"
} as const;

export type LeadStatusType = typeof LeadStatus[keyof typeof LeadStatus];

export const PIPELINE_STAGES = [
    { name: "Target Lead", status: "READY", color: "blue" },
    { name: "Key Info Collected", status: "KEY_INFO_COLLECTED", color: "indigo" },
    { name: "Demo Booked", status: "BOOKED", color: "teal" },
    { name: "Sold", status: "SOLD", color: "emerald" },
    { name: "Onboarded", status: "ONBOARDED", color: "blue" }
] as const;
