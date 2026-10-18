# Verification

```bash
npm ci
npm run typecheck
npm test
npm run build
EXPO_NO_TELEMETRY=1 npm run export:web -w mobile
```

Unit tests check matching weights, geographic exclusion, empty/Unicode feature comparison, chronology and report/registration validation. They do not simulate successful external-service calls.

## Browser smoke tests

With no `admin/.env`, run `npm run dev:admin` in one terminal, then `npm run test:browser` in another. Uses system Chromium by default; set `CHROMIUM_PATH` for another browser executable. Checks explicit setup instructions, no runtime JS errors, mobile navigation and no horizontal overflow.

## API acceptance against disposable Supabase

**Use a disposable test project only.** The script creates five confirmed test accounts with administrator credentials and cleans up only those accounts and their data afterwards. It needs the schema, reference seed and running API. It does not stub Auth, PostgreSQL or Storage.

```bash
# Run from repository root, with backend pointing at the same disposable project.
ALLOW_TEST_USERS=true DOTENV_CONFIG_PATH=backend/.env npm run test:acceptance
```

Checks persisted reports after independent requests, actual image validation/storage, public data projection, unauthorized users, direct RLS reads, denied private hashes/RPC calls, worker matching, in-app notification, five-attempt lockout, ownership verification, participant chat, staff-only physical return, read-only returned chat and audit event. There is a 25s wait for matching. It requires no Gemini or push token; it does not establish AI or device push delivery.

Connected browser coverage: `LIVE_BROWSER=true DOTENV_CONFIG_PATH=backend/.env npx playwright test tests/live.spec.ts` against a disposable project with `admin/.env` pointing to it. This test signs in, creates a report through the form, reloads it and opens the staff desk.

For real-service acceptance, separately verify Gemini output in `reports.ai_description`, `ai_features` and `ai_state`, register a physical device, and check `push_deliveries` reaches `DELIVERED`. Test native camera, permissions, reconnect, expired sessions, slow/failing providers and notification handling on both platforms.

Expo web UI check (with Metro running using `EXPO_NO_TELEMETRY=1 npm run start -w mobile -- --offline`):

```bash
LIVE_BROWSER=true DOTENV_CONFIG_PATH=backend/.env npx playwright test tests/mobile-web.spec.ts
```

This checks the React Native web rendering path. It is not a native Android/iOS device test. See [validation results](VALIDATION.md).
