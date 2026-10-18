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

## Installable Android APK on Windows (EAS)

The checked-in `mobile/eas.json` profile `apk` requests an internal-distribution APK, not a development client or an AAB. It bundles the application and does not require Expo Go, Metro, a QR code or an ngrok tunnel after installation. The APK has not yet been built/signed in the user's Expo account.

From the repository root:

```cmd
git pull
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init
```

Use your own Expo account. Let `init` create/link the EAS project; it adds that account's project ID to app configuration. Do not copy another project's ID. Keep the existing Android package `app.lostnet.mobile` for upgrade compatibility.

In that project's Expo dashboard, add these three environment variables to the **preview** environment (plaintext visibility is appropriate because all EXPO_PUBLIC values are embedded in the application):

- `EXPO_PUBLIC_SUPABASE_URL` — the hosted Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — that project's public anon key.
- `EXPO_PUBLIC_API_URL` — the reachable HTTPS URL of your hosted backend, without a trailing slash.

The ignored `mobile/.env` is not a reliable way to provide values to a remote EAS builder; configure the EAS environment explicitly. Never include the service-role key or Gemini key. They stay on the backend. The API is a separate process/service and is not included in the APK. A loopback address such as localhost/127.0.0.1 points to the phone; a private computer IP only works on the same reachable network and plaintext HTTP is not a supported release deployment. Deploy the API over HTTPS for use away from your computer.

Then, from `mobile`:

```cmd
npx eas-cli@latest build --platform android --profile apk
```

On the first build, let EAS generate an Android keystore if you do not already have one for this app. Preserve the signing credentials for future updates. Follow the build URL printed by the command, wait for success, download the `.apk` on the phone and allow installation from that download source when Android asks.

Public variables are baked into the build; changing them later requires rebuilding the APK. A successful native JS export is not proof that EAS signing/native compilation succeeded. Verify registration, camera/gallery, GPS, text matching, ownership verification and API access on the installed APK. Gemini remains a separate unresolved server/provider issue and is not fixed by packaging the app.

### APK opens but login says Network request failed

Login calls the separate Node API; Expo/EAS does not host that API. Verify the public API URL used in the **preview** environment at build time. On the same phone, open that URL with `/health` appended. Expect JSON with `status: ok`; also check `/ready` for database readiness. If this fails in the browser, investigate server deployment, TLS/DNS and reachability first. A working health response does not verify Supabase Auth connectivity; if login proceeds but session setup fails, check the configured Supabase project as well.

Do not use localhost/127.0.0.1 (the phone itself) or the Expo/Metro tunnel URL as the API address. Release APKs can reject plain HTTP even when the URL opens in a browser, and computer LAN addresses do not work from other networks. Use the actual reachable HTTPS backend URL. EAS public values are embedded when building; updating a local `.env` or dashboard variable does not change an already installed APK. Rebuild with `npx eas-cli@latest build --platform android --profile apk` from mobile after correcting preview variables.

The APK build hook now rejects missing, loopback or non-HTTPS URL settings without printing values/keys. This validates configuration shape only; it does not deploy the server or prove service reachability. The client no longer silently defaults to localhost and explains API connection failures separately from HTTP errors.
