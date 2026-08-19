# Supabase setup for Noisy Deploy

This is the click-by-click guide to turn on **accounts, the free deploy limit,
premium, payments, and the admin dashboard**. It takes about 20 minutes and uses
only the free tier.

You can skip all of this. With `SUPABASE_URL` and `SUPABASE_ANON_KEY` left blank
in `js/config.js`, the site runs exactly like Phase 1: unlimited local deploys,
no premium, no admin. This guide is only needed to enable the paid features.

> Supabase updates its dashboard often. If a button has moved or is named
> slightly differently, look for the nearest equivalent. The concepts (SQL
> editor, Auth users, Edge Functions, Storage buckets, API keys) are stable.

---

## What you will end up with

- A Postgres database with the tables and security rules in `schema.sql`.
- Two admin accounts (Noisy and BloodSkill) that can sign in to `/admin/`.
- Two Edge Functions that enforce the free limit by GitHub username **and** IP.
- A public Storage bucket named `proofs` for payment screenshots.
- Two values pasted into `js/config.js`.

---

## Step 1 — Create the project

1. Go to <https://supabase.com> and sign in (GitHub login is fine).
2. Click **New project**.
3. Name it (e.g. `noisy-deploy`), set a strong **database password** (save it),
   pick the region closest to your users (for Indonesia, **Southeast Asia /
   Singapore**), and click **Create new project**.
4. Wait ~2 minutes for it to finish provisioning.

## Step 2 — Run the schema

1. In the left sidebar open **SQL Editor**.
2. Click **New query**.
3. Open `supabase/schema.sql` from this project, copy **all** of it, paste it in.
4. Click **Run**. You should see "Success. No rows returned."

This creates every table, turns on Row-Level Security, adds the policies, seeds
the default `settings` row and the default `Premium` product, and enables
Realtime on `announcements` and `products`. It is safe to re-run.

## Step 3 — Create the two admin accounts

1. Sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter the email and a password for the first admin (Noisy). **Check "Auto
   Confirm User"** so they can sign in immediately. Click **Create user**.
3. Repeat for the second admin (BloodSkill).

> These are email + password logins used **only** for the admin dashboard. They
> are separate from the GitHub token the site uses to deploy.

## Step 4 — Register admin emails and developer logins

The accounts above can sign in, but they are not admins until their emails are on
the allowlist. Their GitHub usernames also need `developer` plans so their own
deploys are unlimited.

1. Sidebar → **SQL Editor** → **New query**.
2. Paste the block below, replacing the four placeholders with the **real emails
   you just created** and the **real GitHub usernames** of the two developers:

```sql
insert into public.admins (email, name) values
  ('noisy@example.com', 'Noisy'),
  ('bloodskill@example.com', 'BloodSkill')
on conflict (email) do nothing;

insert into public.profiles (github_login, plan) values
  ('NOISY_GITHUB_LOGIN', 'developer'),
  ('BLOODSKILL_GITHUB_LOGIN', 'developer')
on conflict (github_login) do update set plan = 'developer';
```

3. Click **Run**.

> The email in `admins` must match the login email exactly (case-insensitive).
> The `github_login` must match the GitHub username the developer connects with.

## Step 5 — Create the `proofs` Storage bucket

1. Sidebar → **Storage** → **New bucket**.
2. Name it exactly **`proofs`** (lowercase).
3. Toggle **Public bucket** ON (payment screenshots are shown to admins by URL).
4. Click **Create bucket**.

> Public here means "readable by anyone who has the exact file URL". That is
> fine for payment proofs. If you prefer private storage, you would switch the
> client to signed URLs, which is out of scope for this guide.

## Step 6 — Deploy the two Edge Functions

The functions live in `supabase/functions/check-quota/` and
`supabase/functions/record-deploy/`. You can deploy them from the **dashboard**
(no install) or the **CLI**.

### Option A — Dashboard (simplest)

1. Sidebar → **Edge Functions** → **Create a function**.
2. Name it exactly **`check-quota`**.
3. Open `supabase/functions/check-quota/index.ts`, copy all of it, paste it into
   the editor, and click **Deploy**.
4. **Create a function** again, name it exactly **`record-deploy`**, paste
   `supabase/functions/record-deploy/index.ts`, and **Deploy**.

### Option B — CLI

```bash
npm install -g supabase        # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>   # ref is in Project Settings -> General
supabase functions deploy check-quota
supabase functions deploy record-deploy
```

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into functions
> automatically. You do **not** set those yourself.

## Step 7 — Set the IP salt (recommended)

The functions hash caller IPs with a salt so stored values can't be reversed to a
raw IP. Set your own secret salt once:

- **Dashboard:** Edge Functions → **Secrets** (or Project Settings → Edge
  Functions) → add a secret named **`IP_SALT`** with any long random string.
- **CLI:** `supabase secrets set IP_SALT="<paste-a-long-random-string>"`

If you skip this it still works, but uses a weak default salt. Set it.

## Step 8 — Paste your keys into the site

1. Sidebar → **Project Settings** → **API**.
2. Copy the **Project URL** and the **anon / public** key (the `anon` one, not
   `service_role`).
3. Open `js/config.js` and fill them in:

```js
SUPABASE_URL: "https://YOUR-PROJECT-ref.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...your anon public key...",
```

> The anon key is **safe to commit and expose**. The database is protected by
> Row-Level Security, and all quota logic lives in the Edge Functions, which use
> the private service-role key that never leaves Supabase. **Never** put the
> `service_role` key in `config.js` or any client file.

## Step 9 — Verify

1. Serve the site locally (`python -m http.server 8080`) and open it.
2. Connect a **non-developer** GitHub account. You should see the quota banner
   with "3 of 3 free deploys left".
3. Deploy three times. The fourth attempt should be blocked with the upgrade
   prompt. (Counts are enforced by username and IP together.)
4. Open the upgrade modal, upload any image as a "proof", and confirm. A row
   should appear in **Table Editor → payments** with status `pending`.
5. Open `/admin/` (e.g. `http://localhost:8080/admin/`), sign in with an admin
   account, and you should see that pending payment. Approve it, then reload the
   site as that user; the plan should read premium and deploys are unlimited.
6. In the admin **Announcements** tab, publish a message; it should appear on the
   site's banner within a moment (Realtime) or on next reload.

If anything in step 2 fails silently, open your browser devtools console and the
Supabase **Edge Functions → Logs** to see the reason.

---

## Adjusting things later, all from `/admin/`

- **Payments** tab: approve or reject proofs; approving activates 30 days of
  Premium (extends existing time if still active).
- **Users** tab: search a GitHub login to set a plan, extend Premium, or reset
  the free counter (also clears the IP counters tied to that user, to undo a
  shared-IP false block).
- **Pricing** tab: edit price, discount, period, features, and active state. The
  site updates live.
- **Announcements** tab: publish or hide the banner (only the newest active one
  shows on the site).
- **Settings** tab: bank details, Telegram handles, and the free deploy limit.

## Notes and honest limits

- The deploy limit is **server-checked, not deploy-blocking**. The push happens
  browser to GitHub with the user's own token; our server never touches it. We
  require a server OK before deploying and record it after. A determined
  developer could bypass the client code. This is acceptable for a small,
  manually-paid product.
- **Shared IPs** (mobile networks, campus/office WiFi, CGNAT) can false-block
  unrelated people, because we block when **either** the username or the IP has
  reached the limit. Username is primary; IP is a secondary net. If a real user
  is wrongly blocked, reset them in the Users tab.
- If Supabase is ever unreachable, the site **fails open**: deploys still work
  and a small "account limits are disabled" note is shown. A paying user is never
  trapped by an outage.
