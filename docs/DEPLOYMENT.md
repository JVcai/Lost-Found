# Deployment

## Supabase

Apply the SQL migration and reference seed once. Keep `item-images` private. RLS must stay enabled. Configure email delivery and Auth redirect allowlist. Use backups suitable for your plan, then test restoration. Store credentials only in the hosting provider's secret settings.

Set a short JWT expiry consistent with your security needs. Logout revokes refresh tokens; access JWTs remain valid until expiry. Service-role credentials bypass RLS and must never be sent to clients. Rotate a compromised credential immediately.

## Backend

Build with the root `backend/Dockerfile` (`docker build -f backend/Dockerfile .`) or run `npm ci && npm run build`, then `npm start -w backend`. Required runtime values are documented in `backend/.env.example`. The multi-stage image installs only backend/shared production dependencies; Expo and web build tools are excluded from runtime.

Deploy to a Node-compatible HTTPS host. Configure health `/health` and readiness `/ready`, graceful shutdown, a bounded request-body limit at the ingress, exact CORS origins, monitored structured logs, and an external error monitor. Do not enable unrestricted `trust proxy`; configure it for the actual ingress topology before relying on per-client rate limits. The worker polls PostgreSQL jobs; its leases recover after 5 minutes, retries up to four times. One tick is serial per process and SQL uses SKIP LOCKED between replicas.

Monitor `jobs.state = 'FAILED'`, `reports.ai_state = 'FAILED'`, push rejection logs, latency and storage usage. AI failure does not prevent deterministic matching. AI requests time out after 30 seconds. Retrying failed jobs requires an operator to set `state='PENDING', attempts=0`; do this only after fixing the cause.

Push uses a durable PostgreSQL outbox with bounded retries, Expo ticket/receipt checks and stale-device token cleanup. Inspect FAILED deliveries and alert operators; delivery depends on Expo, credentials, OS permissions and device state. Receipt success means provider acceptance, not proof the user saw a notification. In-app notifications remain the durable source of updates.

## Web

Build-time public variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`. Build `npm run build -w admin` and serve `admin/dist` over HTTPS. Add the web origin to backend CORS and Supabase Auth redirect settings. Never set a service-role key in a Vite variable.

## Mobile

Copy public variables into `mobile/.env`. Set the API to an HTTPS address. Run `npx eas-cli init` in `mobile`, then configure EAS project ID and push credentials. Build a development client first and validate camera, picker, GPS, email links and push on actual iOS/Android devices. Native store builds and signing require your Apple/Google/Expo accounts. Store release publication is not automated by this repository.

## Network

Required: npm registry, your `<project-ref>.supabase.co`, `generativelanguage.googleapis.com`, `exp.host`; Expo/EAS build domains as required by Expo. Local Supabase additionally pulls container images from its official public registry. Use supported proxy bindings for HTTPS providers; local cryptographic keys and service-role keys must be supplied as backend runtime configuration rather than copied from proxy placeholders.

## Before launch

Complete the remaining work in STATUS.md, hosted acceptance, native tests, accessibility testing, retention/account deletion policy, SMTP delivery, push receipt handling, cross-replica rate limiting, monitoring/alerts and realistic load testing. The targets of 500ms API latency, 99.5% availability and 100,000 reports have not been measured or established.
