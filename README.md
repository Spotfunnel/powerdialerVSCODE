# Power Dialer - Ship-Ready Sales Engine

A high-performance outbound dialer built with Next.js, Twilio, and HubSpot. Designed for **10-year-old usability**.

## 🚀 30-Minute Setup Checklist (Idiot-Proof)

1. **Clone the Repo**: Download or git clone this folder to your machine.
2. **Environment Setup**: Copy `.env.example` to `.env`.
3. **Set Encryption Key**: Generate a 32-character random string and set it as `ENCRYPTION_KEY` in `.env`.
4. **Start the App**: Run `./scripts/first_run.bat` (Windows) or `docker-compose up` (Docker).
5. **Open /setup**: Visit `http://localhost:3000/setup`.
6. **HubSpot**: Paste your Private App Token and click **Verify**.
7. **Twilio**: Paste Account SID + Auth Token and click **Verify**.
8. **Rep Number**: Enter your mobile number and click **Place Test Call**.
9. **Verify Bridge**: Answer your phone. If you hear the bridge message, it works!
10. **Test Log**: Click **Test HubSpot Log** and check your HubSpot contact for a new call activity.
11. **Webhooks**: Copy the Webhook URL from the wizard and paste it into the Twilio Console (Phone Number -> Configure -> Voice Webhook).
12. **Start Dialing**: Go to `/dialer` and dominate the queue.

---

## ☁️ Deployment Guide

### Option A: 1-Click VPS (Docker)
1. Get a VPS (Ubuntu/Debian).
2. Install Docker & Docker Compose.
3. Upload this repo.
4. Set `.env` variables (including `DATABASE_URL` and `WEBHOOK_BASE_URL`).
5. Run `docker-compose up -d`.

### Option B: Managed Cloud (Vercel + Supabase)
1. Push this repo to GitHub.
2. Connect Vercel to the repo.
3. Set environment variables in Vercel.
4. Provision a managed Postgres (e.g., Supabase) and set `DATABASE_URL`.
5. Deploy.

---

## 🔥 Smoke Test Checklist

1. [ ] **Locking**: Open two tabs. Does only one lead pull at a time?
2. [ ] **Voice**: Place a call. Does the rep phone ring? Does the lead hear the bridge?
3. [ ] **Status**: End a call. Does the dialer UI update the "IDLE" state via webhook?
4. [ ] **Logging**: Save an outcome. Does the HubSpot contact show the call details?
5. [ ] **Retries**: (Simulated) Does a failed HubSpot sync appear in the `SyncJobs` table?
6. [ ] **Conveyor Belt**: Does the next lead load within 2 seconds of saving an outcome?

---

## 🛠️ Repository Tree
```text
powerdialer/
├── prisma/schema.prisma      # DB Schema (SyncJobs, Webhooks)
├── scripts/                  # Setup & Deploy
├── src/
│   ├── app/
│   │   ├── api/              # Wired endpoints
│   │   ├── setup/            # Guided Wizard
│   │   └── dialer/           # Core UI
│   └── lib/                  # Encrypted Services
└── docker-compose.yml        # Zero-Config Start
```
