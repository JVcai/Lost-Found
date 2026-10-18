# API

JSON REST API, default port 3000. All routes except `/health`, `/ready`, and `/auth/*` require `Authorization: Bearer <Supabase access_token>`. Clients refresh sessions with the Supabase SDK. Errors use `{error,message}`; database internals are not returned. List routes currently cap results at 100 (staff reports 200). Pagination must be added before large datasets.

## Authentication

- `POST /auth/register` — `{full_name,email,password}`; returns `{session,email_verification_required}`. Confirmation is checked on the client and password rules on the server. Supabase enforces email uniqueness and verification.
- `POST /auth/login` — `{email,password}` → session.
- `POST /auth/logout` — revokes refresh sessions globally. Already issued JWTs expire according to Supabase token lifetime.
- `POST /auth/reset-password` — `{email}` → generic response, no account enumeration.
- `GET /me` — caller profile and organization memberships.

## Reports / images

- `GET /locations` — active locations.
- `POST /reports` → draft. Required: `type: LOST|FOUND`, `category` (shared categories), `item_name`, `color`, `location_id` UUID, `event_at` ISO with timezone. Optional `brand`, `description`, `unique_features: string[]`, paired `latitude`/`longitude`, `reward`, `storage_location`. FOUND also requires `verification_question` and `verification_answer`; the answer is salted and hashed server-side.
- `POST /reports/:id/images` — multipart `image`; actual file format validated using sharp, 10 MB maximum, 40 megapixel decode limit, up to 5 images. Re-encodes to WebP, strips metadata, creates thumbnail. Draft authors only.
- `POST /reports/:id/publish` — validates required photo/challenge, changes status and atomically queues processing.
- `PATCH /reports/:id/ai-description` — author edits `{ai_description}` on an open report.
- `GET /reports/my` — private own reports, including drafts.
- `GET /reports/search?q=&category=&color=&brand=&date=&status=` — limited public found-item projection. No user ID, exact coordinates, hidden features, descriptions, storage position or contact details. Signed images expire in 5 minutes.
- `GET /reports/:id` — author or staff of that organization.
- `PATCH /reports/:id` — author, drafts only, full report fields, immutable type/location.
- `DELETE /reports/:id` — logical close, retains audit trail; disallowed during an active return.

## Matches / verification / chat

- `GET /matches` — matches involving your reports.
- `GET /matches/:id` — participant or authorized staff, sanitized report projections and score components.
- `POST /matches/:id/confirm` — lost-report owner only; PROPOSED → VERIFYING.
- `POST /matches/:id/reject` — proposed match participant or authorized staff.
- `GET /matches/:id/challenge` — question only, lost-report owner in VERIFYING.
- `POST /matches/:id/verify` — `{answer}`. Database transaction locks the verification, increments attempts, compares bcrypt(SHA256(normalized answer)), rejects after 5 attempts, prevents multiple claims and opens chat after success.
- `GET /matches/:id/messages` — authorized participants/staff, VERIFIED or RETURNED only.
- `POST /matches/:id/messages` — `{message}`, 1–4000 chars, VERIFIED only. Text, system events and private images are supported.
- `POST /matches/:id/images` — multipart `image`, same byte/size validation as reports. VERIFIED participants/staff only.
- `POST /matches/:id/return` — organization staff/platform admin, VERIFIED only. Atomically marks both items returned and rejects competing matches.

## Notifications / staff

- `GET /notifications`; `PATCH /notifications/:id/read` — caller only.
- `POST /push-tokens` — `{token}` Expo token, associated with caller.
- `GET /staff/reports`, `GET /staff/matches` — organization-scoped.
- `PATCH /staff/reports/:id/store` — `{storage_location}`, FOUND/STORED found items only.

The API uses a service-role database connection, so every private operation checks membership on the server. Direct clients have read-only RLS access to their own records. Private challenge hashes, jobs, audit events and tokens have no client grants. Staff onboarding is administrator SQL in this version.

## Matching

Candidates: opposite report types, different authors, same category, within 7 days, same registered location OR PostGIS distance ≤500m, and active status. Score components:

- 40 points: category 30%, color 25%, brand 20%, Jaccard of item name / description / AI feature tokens 25%.
- 30 points: same location, otherwise linear distance decay over 500m.
- 20 points: exponential time decay, 48h constant.
- 10 points: Jaccard of private feature tokens.

70+ creates a match and in-app notification; 90+ requests push. Gemini extracts descriptive visual features; this version does not compute image embeddings or learned visual similarity. The exact heuristics are replaceable in `backend/src/matching.ts`.
