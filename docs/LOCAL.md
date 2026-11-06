# Local mobile development without hosted credentials

Optional development-only Supabase Auth/Storage/PostgREST + PostgreSQL/PostGIS fixture. It omits SMTP, Realtime, Gemini and Expo delivery. All app data lives in the local database; clients poll for updates. Hosted Supabase remains the standard deployment.

Requires Node 22+ and Docker Compose. Images are pinned by digest. Local signing material and database password are generated in ignored `.local-supabase/`. Existing backend/mobile `.env` files and data are preserved. Email auto-confirm is enabled only for this isolated fixture. No admin/web application is created or started.

```bash
npm ci
npm run local:up
# Separate terminals:
npm run local:gateway
npm run dev:api
EXPO_NO_TELEMETRY=1 npm run start -w mobile -- --offline
```

`local:up` initializes a fresh database once. `local:down` stops containers and retains volumes. Never remove volumes containing needed data. No default user/staff account is shipped. Staff membership is assigned by database administrator SQL as documented in README.

For a physical device on a trusted LAN, explicitly bind the development gateway using `LOCAL_GATEWAY_HOST=0.0.0.0 npm run local:gateway` and use the computer's LAN address consistently for Supabase URLs in backend/mobile and the API URL in mobile. Both ports 54321 and 3000 must be reachable from the phone; signed image URLs use the backend's Supabase URL. Production requires HTTPS. Keep server keys on the backend.

Local auth uses the existing `lostnet://auth` scheme for compatibility; full native recovery deep links remain pending. The fixture does not establish email delivery or device push readiness.
