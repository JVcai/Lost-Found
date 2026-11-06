# Testing Lost&Found

```bash
npm ci
npm run typecheck
npm test
npm run build
EXPO_NO_TELEMETRY=1 npm run export:native -w mobile
```

Type checks cover mobile/backend/shared. Build compiles the backend/shared packages. Native export bundles Android/iOS JavaScript and assets; it does not sign native binaries or test a real device. Web/browser tests and Vite have been removed with the web application.

## Matching / API acceptance

Against a **disposable** Supabase project with schema/seed applied and API running:

```bash
ALLOW_TEST_USERS=true DOTENV_CONFIG_PATH=backend/.env npm run test:acceptance
```

Windows cmd equivalent:

```cmd
set ALLOW_TEST_USERS=true
set DOTENV_CONFIG_PATH=backend/.env
npm run test:acceptance
```

Creates and removes its own confirmed test identities using the administrator key. Never point it at a production project. Tests real Auth, PostgreSQL and Storage, report persistence, photo validation, candidate selection excluding the same user, matching across different users, notifications, RLS/authorization failures, ownership attempts/lockout, private text/image chat and audited staff return. It also checks that a losing claim does not strand another lost report in VERIFYING.

Manual phone check: use two accounts/phones. Publish LOST as A and FOUND as B with the same category/location and similar text, color, brand, private features and time. Found needs a photo and ownership challenge. Wait for 70+ match, then verify as A and chat. The finder must not confirm ownership as the lost-item owner. To check handover, use an account with staff membership and open Profile → Staff desk.

Gemini requires a real key and quota; check `reports.ai_state`, `ai_analysis` and `ai_description`. Native push requires physical devices, EAS credentials and a development build. Check both iOS/Android camera, location, reconnect and staff desk. Native UI interactions, push and recovery links are not established by source/bundle tests.
