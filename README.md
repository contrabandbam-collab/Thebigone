# ShortStack app code

This repository now includes a React + TypeScript app shell and a Supabase schema foundation based on the ShortStack master build in [docs/ShortStack_Master_Build_Launch_Ready.txt](docs/ShortStack_Master_Build_Launch_Ready.txt).

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local`.
3. Add a Supabase project URL and the public anon/publishable key.
4. Apply the migration in `supabase/migrations` to a **development** Supabase project.
5. Install packages with `npm install`.
6. Run `npm run dev`; run `npm run build` for a production bundle.

## Current code status

This is the first code scaffold, not a production launch. It includes the consumer discovery screen, text/voice search, location permission handling, public business/promotion views, CALL/EMAIL actions, owner sign-in, draft listing creation, the core schema, and initial row policies.

The following still require implementation/configuration before launch:
- The approved Miami skyline image still needs to be added to `public/`.
- Payment provider account, server-side checkout/webhook functions, and verified renewal/referral processing.
- Admin Console workflows, MFA enrollment/recovery, moderation actions, category editor, staff invitations/permissions, complete photo/Showroom/promotion management, and legal policy content.
- Database review and migration against the real existing app; configure storage bucket and policies; migrate existing data safely.
- Automated tests, accessibility review, security review, preview deployment, and production configuration.

The app intentionally signs out on a fresh launch and after five minutes of inactivity. Preview sample listings appear only when Supabase is not configured and are labeled as non-persistent preview data. Do not use sample data as production records.

## Security notes

- Only the Supabase public anon/publishable key belongs in `VITE_SUPABASE_ANON_KEY`. Never put service-role, payment, or webhook secrets in a Vite variable.
- Payment status and listing activation are server-managed. The browser scaffold does not charge or activate businesses.
- Do not apply the starter migration to production until it has been reviewed against the existing schema and a backup/rollback plan is ready.
