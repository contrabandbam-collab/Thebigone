# ShortStack v2.4 code scaffold

React + TypeScript consumer discovery app and Supabase/Postgres foundation based on the consolidated [master build](docs/ShortStack_Master_Build_Launch_Ready.txt).

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local` and enter a Supabase development project URL and public anon/publishable key.
3. Apply migrations in `supabase/migrations` to a **development copy only**.
4. Run `npm install`, then `npm run dev`. Run `npm run build` to type-check and create the production bundle.

## Implemented in this scaffold

- ShortStack wordmark and motto, responsive discovery/search, voice search where browser support exists, location permission handling, and “Your Stacks” owner access.
- Additive v2.4 database migration with public eligibility filtering, a server-selected 24-hour highlight, broader text search fields, staff permission flags, owner dashboard status view, and server-managed payment/referral history tables.
- Owner draft listing form for business/entity type, listing type, “City and State,” description, service area, public contact information, and searchable keywords.
- Search from within a business profile, public call/email actions, customer reviews display, Local Promotions, and public consumer terms/privacy notice sections.
- Five-minute inactivity sign-out; public sample records are labeled as preview-only and are never shown as eligible paid highlights.

## Not launch-ready

This repository is a code scaffold. The target Supabase project is not connected here, migrations have not been applied or tested against a database, and no production data has been migrated or reconciled.

- The approved emerald, black, and silver stacked-storefront logo file and approved blurred Miami sunset photograph are not available in this workspace. The current header uses text branding; it does not recreate the approved logo. Add the original assets before release.
- Payment provider checkout/webhooks, idempotent payment handling, manual renewal reminders, cancellation/reactivation flows, and referral qualification/discount processing still need trusted server-side functions. The schema deliberately grants no client payment writes. No payment is processed or listing activated by this app.
- Secure device photo uploads, preview/replace/delete, gallery/Showroom, and Promotional Flyer Studio are not implemented. Configure private storage access before enabling owner uploads; the flyer template must use photo upload and contain no QR code.
- Admin Command Center workflows, MFA setup/recovery, moderation UI, category management, billing/referral oversight, staff invitation/permission management, and account deletion are not implemented.
- Address autocomplete, real geocoding/distance, mobile-business coverage beyond text search, and persistent highlight schedule monitoring require configured services.
- Terms and privacy sections are starter copy, not approved legal policy. Obtain legal review and publish complete policies before launch.
- Run a full TypeScript/Vite build, database migration against a safe copy, security regression checks, accessibility/device tests, and payment sandbox tests. Set a nonpayment grace/status policy with the owner/admin before production; this scaffold does not invent one.

Do not apply these migrations to production until the existing schema and data have been backed up, mapped, reviewed, and tested with a rollback plan. Preserve existing business IDs, URLs/QRs, reviews, payment history, referrals, and owner/staff assignments. Use the approved Supabase auth/database/storage/server architecture; never add service-role or payment secrets to `VITE_` variables.
