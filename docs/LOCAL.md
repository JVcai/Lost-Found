# Local development without cloud keys

This optional fixture runs genuine Supabase Auth, Storage and PostgREST services against a compact PostgreSQL/PostGIS container. It is for isolated local development only, not for deployment. It omits Realtime, SMTP, Gemini and the Expo delivery service. The clients poll messages and notifications, so core report/claim/chat workflows work without Realtime.

Requires Node 22+ and Docker Compose. Images are pinned by digest. The database is on an internal Docker network with no published port; service ports and the development gateway bind to loopback by default. Fresh installations generate local JWT signing material and a database password in the ignored `.local-supabase/` directory. Existing `.env` files are preserved. Local email verification is bypassed by Auth auto-confirm, so use hosted Supabase to validate email delivery and confirmation.

```bash
npm ci
npm run local:up
# Separate terminals:
npm run local:gateway
npm run dev:api
npm run dev:admin
# Optional Expo:
EXPO_NO_TELEMETRY=1 npm run start -w mobile -- --offline
```

`local:up` creates application `.env` files **only if missing**, initializes a new database and applies the migration/seed once. On subsequent starts it preserves data. If you already have `.env` files for a hosted project, keep using those; do not overwrite them with local values. If you intentionally switch from hosted to local, back up your own configuration first. Local JWTs are generated credentials, never hosted account credentials.

The local stack is named `lostnet-test`. `npm run local:down` stops its containers without deleting volumes. Never run a volume-removal/reset command against data you need. The local config contains credentials; keep `.local-supabase/` out of version control and shared archives.

Create owner and finder accounts in the app. To assign staff after signup, run a database administrator query via:

```bash
docker compose -p lostnet-test -f .local-supabase/compose.json exec db psql -U postgres
```

Then use the membership SQL in README with a real local user UUID (`select id,full_name from public.profiles;`). No default staff/password is shipped.

The repeatable API acceptance script creates/removes its own test users:

```bash
ALLOW_TEST_USERS=true DOTENV_CONFIG_PATH=backend/.env npm run test:acceptance
LIVE_BROWSER=true DOTENV_CONFIG_PATH=backend/.env npx playwright test tests/live.spec.ts
```

A physical phone cannot reach your computer's loopback address. Use a hosted HTTPS project for device testing, or explicitly bind the gateway with `LOCAL_GATEWAY_HOST=0.0.0.0 npm run local:gateway` on a trusted development network and use the computer's LAN address consistently in backend, admin and mobile Supabase/API URLs. Production must use HTTPS. Native camera/location/push and signing still require platform-specific validation.

The compact fixture was used to validate the SQL migration, API persistence, Storage uploads, matching, RLS, verification lockout, chat, staff return and browser report flow. It does not establish hosted Supabase operational readiness, Realtime delivery, email delivery, Gemini behavior, or native push delivery.
