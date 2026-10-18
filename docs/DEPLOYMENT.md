# Deployment — mobile only

## Supabase

Apply the initial SQL migration and optional location seed once in a new project. Existing projects must apply 002_gps_and_match_reconciliation.sql for GPS-only reports and match reconciliation. Do not rerun 001 or reset the schema. Keep Storage buckets private and RLS enabled. Configure SMTP for email confirmation. Configure Auth redirects for the app's existing `lostnet` scheme only when native deep-link recovery is implemented/tested; see STATUS.md. No web site is included.

## API

Use `npm ci && npm run build && npm start -w backend`, or build `docker build -f backend/Dockerfile .`. The multi-stage image selects backend/shared dependencies and excludes Expo tools. The image still needs verification on a builder with npm registry connectivity; source compilation is tested. Corporate CAs can be supplied via BuildKit's optional `network_ca` secret without disabling TLS verification.

Host over HTTPS; configure runtime values from backend/.env.example, health `/health`, readiness `/ready`, logging/alerts, ingress size limits and trusted-proxy settings. CORS origins default to empty because the only client is native. No service-role/Gemini key may be included in EXPO_PUBLIC_* variables.

Jobs use leases, SKIP LOCKED and bounded retries. Inspect failed processing jobs and push deliveries. Push has a durable outbox, ticket/receipt checks and stale-device cleanup; provider acceptance is not proof the user read the notification. Latency, load, uptime and disaster recovery targets are not established.

## Android / iOS

The display name is Lost&Found. Existing Expo slug, URL scheme and native bundle/package identifiers remain unchanged for upgrade compatibility. Use the mobile/.env public values with reachable HTTPS endpoints. Create/link your EAS project, configure signing/push credentials and build a development client before store releases. Test on real devices. The configuration restricts supported platforms to Android and iOS; no web export/deployment remains.

Required destinations: your Supabase project hostname, generativelanguage.googleapis.com, exp.host, and Expo/EAS/package registries used by your build. Add the concrete project domain to restricted environment networking when connecting hosted services.
