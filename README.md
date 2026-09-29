# Operations Dashboard — Supabase/Gemini Ready

## Current state
The audited front end remains local-first so existing browser data is not lost unexpectedly.
Supabase client configuration, the database schema, RLS policies, and a secure Gemini Edge Function are included.

## Important
- `supabase-config.js` contains only the browser-safe project URL and legacy anon key.
- Never put a Supabase secret/service-role key or Gemini key in `index.html` or GitHub.
- Supabase is moving from legacy `anon` keys to publishable keys. Replace the legacy anon key with your project's publishable key when available.
- `window.opsSupabase.enabled` intentionally remains `false` until Auth and the schema are deployed.

## Setup order
1. Push this folder to GitHub.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Configure Supabase Auth for the team.
4. In Supabase Edge Function secrets, set `GEMINI_API_KEY` to your Gemini key.
5. Deploy `supabase/functions/generate-report`.
6. Connect the front-end CRUD functions to Supabase and set `window.opsSupabase.enabled = true`.
7. Test with at least two user accounts to confirm attribution, RLS, and realtime behavior.

## Data model
- `profiles`: team identity and role
- `tasks`: canonical operational task record
- `task_updates`: immutable update/audit history

Canonical task department values:
Bathroom Cleaning, Room Deep Cleaning, Maintenance, Developer Pipeline, Reception, Other.


## V7: Admin-controlled authentication
- There is no public registration UI.
- Team members sign in only with credentials created by an admin.
- Admin users see a Manage Team tab.
- User creation uses the `admin-users` Edge Function; the service-role key stays server-side.
- Run `supabase/admin-auth-migration.sql` after `schema.sql`.
- In Supabase Auth settings, disable public/new-user signups.
- Create the first admin manually in Supabase Auth, then set that user's `profiles.role` to `admin` in SQL. After that, create team accounts from Manage Team.
- Deploy the `admin-users` Edge Function.

## V8: Real team identity
Run `supabase/real-team-migration.sql` after the V7 schema/migration.

Changes:
- Removes the manual "Updates Posted As" identity control.
- Removes hard-coded assignee names.
- `profiles` is the single people source.
- Assignment UI shows `Display Name — Email`.
- Task assignment values are Supabase profile UUIDs.
- Logged-in Supabase identity is exposed to update/task code through `window.opsIdentity`.
- Department names remain departments, never user accounts.
