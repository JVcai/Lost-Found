# Validation record

Validated in the provided Linux cloud workspace on 2026-10-18 with Node 24.19 and the committed npm lockfile.

| Check | Result |
|---|---|
| Frozen dependency installation (`npm ci`) | Passed |
| TypeScript checks, backend/admin/mobile/shared | Passed |
| Backend and Vite production compilation | Passed |
| Expo web export | Passed |
| Matching / input validation tests | 9 passed, 0 failed |
| Setup-screen browser checks | 2 passed, including mobile width/navigation |
| Connected web workspace | Passed: real login, report form, reload persistence, staff desk |
| Expo web functional check | Passed: real login, bottom tabs, lost-report form |
| SQL schema and RLS installation | Passed on a fresh compact local Supabase-services database |
| Local startup helper | Passed initialization and repeated start, preserving data and `.env` files |
| API acceptance | Passed: separate identities, real Auth/PostgreSQL/Storage, uploads, matching, notification, RLS denials, ownership attempt limit, text/image chat, audited staff return |
| Backend/shared production npm audit | 0 known vulnerabilities reported |
| Whole mobile/tooling dependency audit | Unresolved high/moderate transitive advisories; see STATUS.md |
| Docker production image | Unverified: nested container dependency downloads could not complete through cloud networking |
| Hosted Supabase, SMTP and Realtime delivery | Not run |
| Gemini responses and quality | Not run: no API key supplied |
| Expo push delivery / receipts on a device | Not run: no EAS/device credentials supplied |
| Native Android/iOS builds, signing and stores | Not run |
| Load, latency, uptime and restore targets | Not established |

The local fixture uses Supabase Auth/Storage/PostgREST and PostgreSQL/PostGIS, with no mocked successful external provider response. It is not the full Supabase hosted environment. The API acceptance script creates and removes test users; no default production user or staff account is installed.

Production source compilation and local acceptance do not establish production readiness. The remaining scope is tracked in STATUS.md. Environment install/start instructions are saved as a configuration draft; publication and restoration in a new task are separate, unverified operations.
