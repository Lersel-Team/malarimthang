# Supabase setup (owner steps)

Cloud save is prepared in code but not switched on. Do these steps in the Supabase dashboard.

## 1. Create the tables
1. Open your project, then SQL Editor, then New query.
2. Paste the whole of `supabase/migrations/0001_saves.sql` and press Run.
3. It is safe to run again; it only creates what is missing.
4. Check Table Editor: `profiles` and `saves` exist, each showing "RLS enabled".

## 2. Enable anonymous sign-ins (guest play)
1. Authentication, then Sign In / Providers (or Settings).
2. Turn on "Allow anonymous sign-ins" and save.
3. If this stays off, the game keeps working with local saves only.

## 3. Protect anonymous sign-ins with CAPTCHA (Turnstile)
1. In Cloudflare, create a Turnstile widget for your game domain; copy the site key and secret.
2. In Supabase: Authentication, then Attack Protection, enable CAPTCHA, choose Turnstile, paste the secret.
3. The site key goes into the game client later (a developer step); until then do not enable CAPTCHA enforcement, or guest sign-in will fail.

## 4. Google sign-in (later)
1. Create an OAuth client in Google Cloud Console (Web application).
2. Add the Supabase callback URL shown on Authentication, then Providers, then Google as an authorized redirect URI.
3. Paste the client ID and secret into the Google provider in Supabase and enable it.
4. Add your game URL under Authentication, then URL Configuration.

## 5. Give the game its project address
Create `.env.local` (never committed) with:

    VITE_SUPABASE_URL=<project URL from Settings, then API>
    VITE_SUPABASE_ANON_KEY=<anon public key from the same page>

The anon key is public by design; the row level security policies protect the data. Never put the service role key in the game.

## Free plan limits to know
- Database 500 MB, file storage 1 GB, 50,000 monthly active users.
- Projects with no activity for 7 days are paused; open the dashboard to restore.
- Each save is capped at about 200 KB by the table check, so 500 MB holds a very large number of players.
- Free plan has no automatic backups; export if the data matters.
