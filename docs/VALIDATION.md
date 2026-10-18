# Validation scope

Current mobile-only checks passed: TypeScript for all remaining workspaces, backend/shared compilation, 9 matching/input tests, Android and iOS JS/assets exports, frozen npm installation and the full local API acceptance including same-account exclusion. A native export does not validate device UI, signing or push.

Prior baseline (before removal) passed a full API acceptance scenario against real local Supabase Auth/Storage/PostgREST and PostgreSQL/PostGIS, including RLS denials, ownership lockout, private text/image chat and staff return. Browser/Vite and Expo-web checks from that baseline are historical and no longer part of this product or CI.

The API acceptance script now explicitly checks same-account candidate exclusion and different-account eligibility. The mobile staff desk needs physical-device UI validation; backend staff permissions/storage/return behavior are covered by API checks.

Hosted credentials, SMTP/Gemini/provider delivery, native store builds, performance/availability and fresh-task restoration/publication are separate validation work. Remaining limitations are in STATUS.md.
