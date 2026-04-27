# Quick Call Feature — Design

## Goal

Let the user drop a phone number into the dialer and call it without creating a Lead/Contact. Calls should still appear in the recent-calls history (so duration/recording are preserved), but with no contact attached.

## User intent (decisions captured)

- **Tracking**: logged but unattached — Call row exists, no Contact/Lead created.
- **UI placement**: collapsed pill button in the dialer; expands to a small input panel; also keyboard shortcut.
- **Input style**: text input only (paste-friendly, keyboard-driven). No on-screen dialpad.

## Schema change

`Call.leadId` is currently required (`String`). Make it optional:

```prisma
model Call {
  id           String   @id @default(cuid())
  leadId       String?            // was: String
  ...
  lead         Lead?    @relation(fields: [leadId], references: [id])  // was: Lead
}
```

Migration: `prisma migrate dev --name call_leadid_optional`.

Existing rows are unaffected (all have leadIds today).

## Backend changes

**`src/app/api/voice/twiml/route.ts`** (lines 80–95)

Today: only creates a `Call` row if a Lead matches the dialed number. For unattached quick calls, nothing is logged.

Change: always create the Call row when `userId` is present. Set `leadId` to the matched lead's id, or `null` if no match.

```ts
if (userId) {
    const lead = await prisma.lead.findFirst({ where: { phoneNumber: to } });
    prisma.call.create({
        data: {
            userId,
            fromNumber: callerId,
            toNumber: to,
            direction: 'OUTBOUND',
            status: 'initiated',
            leadId: lead?.id ?? null,
        }
    }).catch(e => console.error("[TwiML] Call Log Error:", e));
}
```

**`src/app/api/calls/recent/route.ts`**

Already uses `call.lead?.firstName` etc. with `'Unknown'` fallback. Once `leadId` is nullable, the include keeps working. Update the formatter so unattached calls show the dialed number instead of `'Unknown'`:

```ts
leadName: call.lead
    ? `${call.lead.firstName || ''} ${call.lead.lastName || ''}`.trim() || call.lead.companyName
    : (call.toNumber || 'Quick Call'),
```

No other API touches needed. `/api/call/log` is for `LeadActivity` (requires leadId) and is irrelevant for quick calls — the front-end just skips that POST.

## Frontend changes — `src/components/dialer/CallInterface.tsx`

Add state:
```ts
const [showQuickCall, setShowQuickCall] = useState(false);
const [quickCallNumber, setQuickCallNumber] = useState('');
const [quickCalling, setQuickCalling] = useState(false);
const quickCallInputRef = useRef<HTMLInputElement>(null);
```

**UI**: small pill button positioned near the system status indicator (top-right). Click expands an inline panel below it with:
- Auto-focused text input (placeholder: `+61 4xx xxx xxx or paste any number`).
- Live-normalized preview underneath (shows what will actually be dialed via `normalizeToE164`).
- Call button (disabled until normalized number is non-empty and system is ready).
- ESC closes; ENTER in input triggers Call.

**Handler**:
```ts
const handleQuickCall = async () => {
    const e164 = normalizeToE164(quickCallNumber);
    if (!e164 || !isSystemReady) return;
    setQuickCalling(true);
    try {
        await dial(e164);
        setStats(prev => ({ ...prev, calls: (prev.calls || 0) + 1 }));
        setShowQuickCall(false);
        setQuickCallNumber('');
    } finally {
        setQuickCalling(false);
    }
};
```

**Keyboard shortcut**: extend the existing `useEffect` that handles `D`/`H` to add `Q`:
- `Q` (no modifiers, not in input) → opens panel and focuses input. Closing handled by ESC or Call.

**Disabled while in a call**: hide or grey the pill if `isConnected || isIncoming` to avoid confusion (you can't start two calls at once).

## Data flow

1. User opens panel, types/pastes number, hits Call.
2. Front-end calls `dial(e164)` → Twilio Device → POSTs to `/api/voice/twiml`.
3. TwiML route looks up matching Lead (none for a fresh number), creates Call row with `leadId: null`, returns `<Dial>` TwiML with rotated callerId.
4. Front-end skips `/api/call/log` (no leadId).
5. Recent-calls history fetches the new row and shows `toNumber` instead of a contact name.

## Error handling

- Empty/invalid input → button disabled, no submission.
- Same dialing errors as the main flow → suppressed in console (matches existing pattern).
- Schema migration: rolled forward only; backward compat is fine because no callers rely on `leadId` being non-null at the type level (a recent-calls type tweak handles it).

## Testing

- Type a number, hit Call → call connects, panel closes, row appears in recent calls with `toNumber` as the label.
- Press `Q` while idle → panel opens, input focused.
- Press ESC → panel closes.
- Try to open while in a call → button hidden.
- Pre-existing lead-based calls still log/show correctly.

## YAGNI omissions (deliberately not in scope)

- No on-screen dialpad (in-call DTMF stays a separate future feature).
- No "save as contact" prompt after call (user explicitly rejected).
- No history pagination for unattached calls.
- No bulk quick-call import.
