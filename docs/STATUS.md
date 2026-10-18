# Lost&Found — current scope

The app is mobile-only (Android/iOS). The previous React/Vite workspace, browser tests, web dependencies and web export/deployment commands have been removed. Backend and Supabase remain required. Display branding is Lost&Found; technical package/import identifiers remain compatible.

Implemented: Supabase email/password auth, lost/found drafts and publishing, camera/gallery, GPS, private compressed images, report editing, search, matching with 40/30/20/10 weights, Gemini adapter and editable descriptions, in-app notifications and Expo push adapter, ownership challenge/attempt limit, private text/image/system chat. Profile → Staff desk now supports organization reports, storage assignment, conversation and confirmed physical handover. API authorization and database permissions remain authoritative.

Same-account reports are intentionally excluded from matching. Use two users as documented in README. Apply migration 002 for GPS-only reports and invalidation of stale proposed matches; no schema reset is needed.

Remaining work includes native email-recovery deep links/new-password flow (the former web recovery screen was removed), genuine visual embeddings/matching quality evaluation, image deletion/pagination/full filter UI, dispute escalation after lockout, mobile organization/staff administration and analytics, QR/deep links and other V2 features, deletion/retention policy and production monitoring. Email reset requests exist but end-to-end recovery is not yet supported by the mobile app.

Hosted Gemini/SMTP/Realtime and device push require real credentials and separate validation. Android/iOS device behavior, signing, store releases, load/latency/uptime and restore targets remain unverified. Native JS export is not an APK/IPA build or device test.

Backend/shared production npm audit previously reported no known vulnerabilities after upgrading sharp. Expo tooling has unresolved transitive advisories and needs a coordinated remediation before store/production releases. Docker image dependency downloads could not complete in the onboarding machine; do not claim the container image is validated.

GPS can be the report location without a registered venue. Its coordinates are shown to the author and used for geographic candidate selection, while public projections omit exact coordinates. Selecting a venue replaces GPS and vice versa; optional reverse geocoding only supplies a city/district label. Both known GPS positions take precedence over a shared venue when checking distance.

Matches are grouped by the caller's own report; finder and owner see the opposite report in each pair. Duplicate match IDs and rejected pairs are not displayed. LOST/FOUND is the report type; “Possible match — unverified” is a suggestion status, not proof of a find or return. Unrelated objects need substantive item evidence, not just category/place/time. Existing PROPOSED suggestions are reconciled on report/match reads, but VERIFYING/VERIFIED/RETURNED history is not retroactively rewritten. The system does not change an author's report type based on AI.
