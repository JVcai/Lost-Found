# Validation scope

Current mobile-only checks passed: TypeScript for all remaining workspaces, backend/shared compilation, 15 matching/input/presentation regression tests, Android and iOS JS/assets exports, frozen npm installation and the full local API acceptance including same-account exclusion. A native export does not validate device UI, signing or push.

Prior baseline (before removal) passed a full API acceptance scenario against real local Supabase Auth/Storage/PostgREST and PostgreSQL/PostGIS, including RLS denials, ownership lockout, private text/image chat and staff return. Browser/Vite and Expo-web checks from that baseline are historical and no longer part of this product or CI.

The API acceptance script now explicitly checks same-account candidate exclusion and different-account eligibility. The mobile staff desk needs physical-device UI validation; backend staff permissions/storage/return behavior are covered by API checks.

Hosted credentials, SMTP/Gemini/provider delivery, native store builds, performance/availability and fresh-task restoration/publication are separate validation work. Remaining limitations are in STATUS.md.

The GPS/matching correction additionally passed real local API/PostGIS checks: GPS-only reports with null venue/organization, private access denial for unrelated staff, rejection of distant coordinates despite the same venue, same-user exclusion, withdrawal of an old unrelated PROPOSED match and resetting its lost report to ACTIVE without changing type. GPS sensor acquisition and reverse geocoding still require a physical-device check; exports/test coordinates are not a hardware test. Existing hosted projects must apply migration 002 before running this revision.
