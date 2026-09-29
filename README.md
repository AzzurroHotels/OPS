# OPS CONTROL V9 — Supabase Complete

This build removes the legacy localStorage task/team system.

## Required deployment order
1. Replace GitHub files with this package.
2. Run `supabase/v9-complete.sql` in Supabase SQL Editor.
3. Deploy Edge Function `admin-users` from `supabase/functions/admin-users/index.ts`.
4. Deploy Edge Function `generate-report` from `supabase/functions/generate-report/index.ts`.
5. Add `GEMINI_API_KEY` as a Supabase Edge Function secret.
6. In Supabase Auth settings disable public signups.
7. Test as Alvin admin: create a team member, create a task, assign it, post an update, log out, log in as that team member.

## Identity
No manual "posted as" selector exists. `created_by` is always the authenticated profile UUID.

## Team
Only real Supabase profiles appear. Admin-created credentials create real Auth users. Departments are not users.

## Tasks
All CRUD is Supabase-backed. Realtime subscriptions refresh tasks, updates, and team profiles.
