# Setting up your own Jarvis

This is a personal dashboard: tasks + calendar, a Claude-powered assistant
("Jarvis") that can read and act on your data by voice or text, net worth,
a trading journal, health logging, a gym tracker, and a social-media content
pipeline. Everything runs on your own Supabase database, your own Vercel
deployment, and your own API keys — nobody else's data touches it.

**⚠️ Before you run the migrations**: a few of them seed real personal data
(bank account names, real recurring payments, real historical balances)
from the original owner's finances. See the "Migrations" section below for
exactly which ones to skip or edit first.

## 1. Prerequisites

- Node.js 20+ and npm
- A [Supabase](https://supabase.com) account (free tier is enough)
- A [Vercel](https://vercel.com) account (free tier is enough)
- An [Anthropic API key](https://console.anthropic.com) (this is what makes
  Jarvis work — pay-as-you-go, no subscription needed)
- An [OpenAI API key](https://platform.openai.com) (voice transcription +
  spoken replies — optional, skip if you don't want voice)
- A Google account, for a Google Cloud OAuth app (calendar sync)

## 2. Clone and install

```bash
git clone <this-repo-url> my-jarvis
cd my-jarvis
npm install
cp .env.example .env.local
```

## 3. Supabase

1. Create a new Supabase project.
2. Go to **Project Settings → API** and copy the **Project URL** and the
   **service_role key** (not the anon key — the app talks to Supabase only
   from its own server-side routes, using the service role key, which
   bypasses Row Level Security by design) into `.env.local` as
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Open the **SQL Editor** and run every file in `supabase/migrations/` **in
   numeric order** (0001, 0002, 0003, ...).

   **Skip or edit these three before running them** — they contain the
   original owner's real personal data, seeded directly in the migration
   rather than through the app:
   - `0006_networth_backfill.sql` — a full historical net worth backfill
     with real account balances. **Skip this file entirely.** Your net
     worth will just start empty and build up from today.
   - `0007_recurring_payments.sql` — creates the `recurring_payments`
     table (keep this part) **and** seeds ~17 real subscriptions/bills with
     real amounts (Spotify, rent, car finance, etc.). Either delete the
     `insert into ... values (...)` block before running, or run it as-is
     and delete the rows afterward from the table — either way, add your
     own bills afterward via the dashboard or by asking Jarvis.
   - `0012_recurring_payments_is_debt.sql` — flags three specific named
     rows (`Lendable`, `MBNA Loans`, `Oodle Car Finance`) as debts. Harmless
     to run even if you skipped the seed data above (it just won't match
     any rows), or delete the `update` statement if you'd rather not run it
     at all.

   Every other migration is pure schema (tables, columns, RLS) — safe to
   run as-is.

## 4. Google Calendar

1. In [Google Cloud Console](https://console.cloud.google.com), create a
   project (or use an existing one) and enable the **Google Calendar API**.
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth
   client ID**, application type **Web application**.
3. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/google/callback` (for local dev)
   - `https://<your-vercel-domain>/api/google/callback` (once you've deployed)
4. Copy the **Client ID** and **Client Secret** into `.env.local` as
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. While your OAuth consent screen is in **Testing** mode, only accounts you
   explicitly add as test users can connect — add yourself under **Audience
   → Test users**. (Testing-mode refresh tokens can also expire after a
   week of inactivity; publish the app, or re-connect via the dashboard's
   "Connect Google Calendar" button if that happens.)

## 5. Fill in the rest of `.env.local`

- `AUTH_SECRET`, `CRON_SECRET`, `HEALTH_WEBHOOK_SECRET` — any long random
  string each, e.g. `openssl rand -hex 32`. These are just internal secrets
  the app generates and checks itself, not tied to any external account.
- `DASHBOARD_PASSWORD` — whatever password you want to log in with.
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — from the accounts in step 1.
- Leave `TRUELAYER_*` blank unless you specifically want to try UK Open
  Banking sync — it's optional and, in the original build, never got real
  bank data working end-to-end (see the comment in `.env.example`). Net
  worth accounts work fine with manual/Jarvis-driven updates without it.

## 6. Run it locally

```bash
npm run dev
```

Open `http://localhost:3000`, log in with your `DASHBOARD_PASSWORD`, and
click **Connect Google Calendar** to finish the calendar setup.

## 7. Deploy to Vercel

```bash
npx vercel
```

Then, in the Vercel project's **Settings → Environment Variables**, add
every variable from your `.env.local` **except** `DEV_AUTH_BYPASS_SECRET`
(that one's local-dev-only and the route hard-disables itself in production
regardless, but there's no reason to set it). Also add:

- `WEBAUTHN_RP_ID` — set this to your exact deployed domain (no `https://`,
  no trailing slash), e.g. `my-jarvis.vercel.app`. This enables Face ID /
  passkey login. Must match exactly or passkey login will fail silently.

Redeploy (`npx vercel --prod`) after adding env vars so they take effect.

The two cron jobs in `vercel.json` (daily net worth snapshot, content-task
generation) are picked up automatically on deploy — no extra setup.

## 8. Optional: Apple Health sync

If you want steps/sleep/workouts to show up automatically, install
[Health Auto Export](https://apps.apple.com/app/health-auto-export/id1115567069)
on your iPhone, create a new REST API automation pointing at
`https://<your-domain>/api/health/webhook`, and add the header
`X-Webhook-Secret: <your HEALTH_WEBHOOK_SECRET value>`.

## Making it your own

The core (Jarvis chat, tasks, calendar) is generic. The rest of the
dashboard — net worth, debts, trading journal, gym tracker, social media
pipeline — was built around the original owner's specific life and is
probably not what you want wholesale. Everything's just a React component
in `src/components/` wired into `src/components/TaskBoard.tsx` and
`src/app/page.tsx` — delete or repurpose whichever sections don't apply to
you, and tell Jarvis (via the chat, in plain language) what you'd like it
to track instead. Most features in this app were originally built the same
way: by describing what was wanted in chat, not by hand-writing every
feature up front.
