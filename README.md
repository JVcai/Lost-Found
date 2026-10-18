# LostNet

Mobile-first Lost & Found: Expo / React Native + TypeScript → NestJS API → Supabase Auth, PostgreSQL, Storage, Realtime → Gemini + Expo Push.

This repository implements a first development version. It is **not yet a production release**. The hosted Supabase/Gemini setup, real-device notifications, native releases, load and operational acceptance must be completed before launch. See [current coverage and limitations](docs/STATUS.md).

## Structure

- `mobile/` — Expo app, bottom tabs, registration/login, camera/gallery, optional GPS, reports, matches, ownership and chat.
- `backend/` — NestJS REST API, validation, private uploads, authorization, durable processing jobs, matching, Gemini and Expo Push adapters.
- `admin/` — responsive React staff/community workspace. Organization staff can assign storage and confirm verified returns.
- `database/` — Supabase SQL migration, private Storage bucket, RLS, PostGIS and optional reference locations.
- `packages/shared/` — shared Zod schemas and TypeScript types.
- `docs/` — API, deployment, verification and scope notes.

## Requirements

Node.js 22+ (tested on 24), npm 11, a Supabase project. Gemini is required for image analysis; without it, structured text/location/time/feature matching still runs and AI is explicitly marked failed. Push needs a physical device, Expo EAS project and a development build.

```bash
npm ci --cache /workspace/.npm
npm run typecheck
npm test
npm run build
```

The custom npm cache is useful in this cloud environment; elsewhere `npm ci` is sufficient. `postinstall` builds the shared package. Lockfile is committed.

## Try locally without cloud keys

Run `npm run local:up`, then start `npm run local:gateway`, `npm run dev:api` and `npm run dev:admin` in separate terminals. Docker is required. Existing `.env` files are preserved; local files are generated only when missing. See [local setup and its limits](docs/LOCAL.md).

## Connect Supabase

1. Create a Supabase project. In **SQL Editor**, run `database/migrations/001_initial.sql`, then optionally `database/seed.sql`. The migration is one-time; do not repeatedly run it against an existing schema.
2. Enable email/password authentication. Keep email confirmation enabled in production. Set Site URL and allowed redirect URLs for your web deployment in Auth settings. Configure SMTP before production.
3. Copy each application's `.env.example` to `.env`. Obtain URL, anon key and **server-only service-role key** from Supabase project settings. Put the service-role and Gemini keys only in `backend/.env` or your backend host's secret settings. Never send them in chat or commit them.
4. Add your Gemini key on the backend. Set `CORS_ORIGINS` to the exact allowed web origins. No JWT secret is needed: Supabase Auth validates access tokens.
5. Sign up using the UI and verify the email. Create a second account to act as the finder. Configure a staff account with the SQL below.

```sql
-- Run as the database administrator. Replace UUIDs with real auth user IDs.
insert into public.staff_members(organization_id,user_id,role)
values ('a1000000-0000-4000-8000-000000000001','<staff-user-id>','STAFF');
-- ORG_ADMIN is reserved for organization management. No client can self-promote.
```

No service keys are needed by the clients. The anon key is public by design; RLS and the API enforce access.

## Run

Use the existing checkout. Cloud tasks are isolated; do not create worktrees unless explicitly requested.

```bash
# terminal 1 — loads backend/.env
npm run dev:api
# terminal 2 — loads admin/.env
npm run dev:admin
# terminal 3 — loads mobile/.env
EXPO_NO_TELEMETRY=1 npm run start -w mobile -- --offline
```

The API uses port 3000, Vite 5173, Expo 8081. Check API `/health` and `/ready` with local requests. `/ready` verifies the database and reports whether AI credentials are configured; it does not verify Gemini billing or push delivery.

For a physical phone, change `EXPO_PUBLIC_API_URL` to a reachable LAN/HTTPS address. Do not use the phone's `localhost` for a remote server. Camera/location permissions are requested on use. Expo SDK 54 push notifications on Android require a development build, not Expo Go. Register push from the Profile tab after setting your EAS project ID.

## Acceptance workflow

See [testing](docs/TESTING.md) for an executable API acceptance scenario and browser tests. The intended real-service acceptance flow is:

1. Owner and finder sign up and verify their emails.
2. Owner creates a lost report at an active location.
3. Finder creates a matching found report, uploads a photo and sets a private question and answer.
4. Reload: both reports persist. Processing creates a match and in-app notification; strong matches request push delivery to registered devices.
5. Owner confirms the match, answers the private question (5 attempts maximum), and opens secure chat.
6. Staff assigns storage before claim if necessary, then confirms physical handover after verification.
7. Both reports and the match show `RETURNED`. Conversations remain readable and become read-only.

Never put a verification answer in a public item name or photo. Use a meaningful private fact. Automated matching is a suggestion, not proof of ownership.

## More

[Original specification](docs/SPECIFICATION.md) · [API](docs/API.md) · [Deployment](docs/DEPLOYMENT.md) · [Coverage / limitations](docs/STATUS.md) · [Tests](docs/TESTING.md)
