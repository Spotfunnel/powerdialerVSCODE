# Agent Instructions

> Mirrored to CLAUDE.md, AGENTS.md, GEMINI.md — same instructions in any AI environment.

## Stack

- **Framework**: Next.js 14 (App Router) + React 18 + TypeScript
- **Auth**: NextAuth (credentials provider) + Prisma adapter
- **Database**: PostgreSQL via Prisma; pooled connection via Supabase pgbouncer
- **Telephony**: Twilio Voice SDK (browser) + Twilio REST/Webhooks (server) + Twilio SMS
- **Calendar**: Google Calendar + Gmail via OAuth tokens stored in `CalendarConnection`
- **Push**: Web Push (VAPID)
- **Testing**: Vitest (`environment: node`, no jsdom), tests in `tests/**/*.test.ts`
- **Hosting**: Vercel (App Router), Vercel Cron for scheduled jobs

## Workspace

`c:\Users\leoge\OneDrive\Documents\AI Activity\VSCODE\powerdialer`

## Directory map

- `src/app/(production)/**` — authed pages (dialer, leaderboard, history, etc.)
- `src/app/api/**` — Next.js Route Handlers
  - `src/app/api/twilio/**` — Twilio webhooks (signature-validated; see `src/lib/twilio.ts:validateTwilioRequest`)
  - `src/app/api/voice/**` — Voice SDK URL endpoints (also signature-validated)
  - `src/app/api/cron/**` — Vercel Cron endpoints (gated by `Authorization: Bearer ${CRON_SECRET}`)
  - `src/app/api/admin/**` — admin routes (gated by `session.user.role === "ADMIN"`)
- `src/components/dialer/**` — call UI (CallInterface, DispositionPanel, GlancePanel, etc.)
- `src/contexts/**` — React contexts (TwilioContext, LeadContext, NotificationContext, ToastContext)
- `src/lib/**` — pure helpers + Prisma client
  - `src/lib/dialer-logic.ts` — lead acquisition + disposition (uses `prisma.$transaction`)
  - `src/lib/number-rotation.ts` — outbound number selection with cooldown (atomic `$transaction`)
  - `src/lib/twilio.ts` — Twilio SDK helpers + `validateTwilioRequest`
  - `src/lib/twilio-incoming.ts` — pure event-wiring for incoming calls
  - `src/lib/disposition-failure.ts` — pure failure handler used by DispositionPanel
- `prisma/schema.prisma` — DB schema (Lead, Call, Callback, Meeting, NumberPool, Settings, etc.)
- `tests/**/*.test.ts` — vitest specs (Prisma mocked at `@/lib/prisma` boundary)
- `.env.example` — required env vars

## Operating rules

### 1. TDD discipline

Before any production code change:
1. Write a failing test that pins the desired behavior
2. Run it → confirm it fails for the right reason
3. Write minimum code to make it pass
4. Run full suite → no regressions
5. Refactor if needed, stay green

Tests live in `tests/`. Mock at module boundaries (`vi.mock("@/lib/prisma", ...)`, `vi.mock("@/lib/twilio", ...)`, `vi.mock("@/lib/push", ...)` — push has VAPID side effects at module load and must always be mocked).

### 2. Never break these invariants

- **Webhook signature validation**: every route under `src/app/api/twilio/**` and `src/app/api/voice/twiml/**` must call `validateTwilioRequest(req, req.url, params)` BEFORE any DB read or write. No `NODE_ENV` gates.
- **Atomic disposition writes**: lead.update + call.update/create + (CALLBACK ? callback.create) + (BOOKED ? meeting.create) MUST run inside a single `prisma.$transaction(async tx => ...)`.
- **Single source for `LeadStatus`**: only `src/lib/types.ts` exports it. Do not re-export from `src/lib/prisma.ts` or anywhere else.
- **Cron auth guard**: `if (!cronSecret || authHeader !== \`Bearer ${cronSecret}\`)` — never the inverted form.
- **TwiML XML escape**: any user/DB-supplied string interpolated into TwiML must pass through an `escapeXml` helper.
- **Number rotation atomicity**: `selectOutboundNumber` uses its own internal `$transaction`. Never nest it inside another `$transaction`.

### 3. Risky actions require user confirmation

- Deleting files, dropping tables, dropping migrations
- Pushing to remote, force-pushing, opening PRs
- Running `prisma migrate deploy` or modifying production data
- Mass refactors (>5 files) without an approved plan
- Removing `next.config.js` build-error suppression (will surface a long tail of pre-existing type errors — coordinate)

### 4. When you find a bug

1. Reproduce with a failing test FIRST
2. Fix
3. Confirm test goes green
4. Run the full suite

If a fix touches a file the user is actively editing in another session, flag it before committing.

## Reference behavior

- **Inbound call routing**: presence threshold is 120s (see `src/lib/presence.ts`). Heartbeat is 45s; DB throttle is 55s. The 120s window absorbs tab-suspend skew.
- **Outbound dial flow**: browser SDK → `device.connect({ params: { To, userId } })` → Twilio fetches `POST /api/voice/twiml` → returns `<Dial>` TwiML → status callbacks at `/api/twilio/status` → recording at `/api/twilio/recording`.
- **Bridge (phone-rep) dial flow**: `POST /api/call/initiate` → `initiateBridgeCall` → Twilio dials rep's PSTN → `GET /api/twilio/twiml/bridge` returns `<Dial>` TwiML to bridge to lead. (Note: `/api/call/initiate` currently has no internal callers — the active dial flow is the SDK path.)
- **Disposition flow**: rep clicks status → `LeadContext.updateLeadStatus` POSTs → server runs `updateLeadDisposition` (atomic tx) → external Google/SMS dispatch (best-effort, outside tx) → returns `{ success, dispatch }`.

## When in doubt

Read the test file for the area you're touching. Tests document the contract more reliably than comments. If a test doesn't exist, write one before changing the behavior.
