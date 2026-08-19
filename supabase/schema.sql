-- ============================================================================
-- Noisy Deploy — Supabase schema, RLS policies, and seed data.
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT where practical.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Admin allowlist. Only these authenticated emails may write privileged data.
-- After creating the two admin users in Auth, their emails must appear here.
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  email text primary key,
  name  text
);

-- Helper: is the current authenticated user one of our admins?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles — one row per GitHub user (identity = github_login, no signup).
-- plan: 'free' | 'premium' | 'developer' (developer = unlimited, never expires)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  github_login  text primary key,
  plan          text not null default 'free' check (plan in ('free','premium','developer')),
  premium_until timestamptz,
  deploy_count  integer not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ip_usage — deploy counter keyed by a hash of the caller IP (never store raw IP).
-- Written only by the record-deploy Edge Function (service role).
-- ---------------------------------------------------------------------------
create table if not exists public.ip_usage (
  ip_hash      text primary key,
  deploy_count integer not null default 0,
  last_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- deployments — audit log of successful deploys (written by Edge Function).
-- ---------------------------------------------------------------------------
create table if not exists public.deployments (
  id           bigint generated always as identity primary key,
  github_login text,
  ip_hash      text,
  repo         text,
  url          text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- payments — manual payment proofs awaiting admin review.
-- proof_url points at an object in the 'proofs' storage bucket.
-- plan_name/days record which plan was bought and how long to grant on approval
-- (so a 1-year plan grants 365 days, not a hardcoded 30).
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id           bigint generated always as identity primary key,
  github_login text not null,
  amount       integer,
  proof_url    text,
  method       text default 'seabank',
  plan_name    text,
  days         integer not null default 30,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by  text,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
-- Bring existing installs up to date (no-op if the columns already exist).
alter table public.payments add column if not exists plan_name text;
alter table public.payments add column if not exists days integer not null default 30;
-- products may carry an optional tagline shown under the plan name.
alter table public.products add column if not exists tagline text;

-- ---------------------------------------------------------------------------
-- payment_methods — how buyers can pay (bank, e-wallet, QRIS, other). Editable
-- in admin, shown live in the payment modal. qr_url points at a public image in
-- the 'assets' bucket (optional, mainly for QRIS).
-- ---------------------------------------------------------------------------
create table if not exists public.payment_methods (
  id           bigint generated always as identity primary key,
  label        text not null,
  kind         text not null default 'bank' check (kind in ('bank','ewallet','qris','other')),
  account      text,                 -- account/phone number, or blank for pure-QR
  holder       text,                 -- account holder name
  instructions text,                 -- optional extra note shown to the buyer
  qr_url       text,                 -- optional QR image (public URL in 'assets')
  active       boolean not null default true,
  sort         integer not null default 0,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- products — the pricing/plans shown on the site (editable in admin, live).
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id             bigint generated always as identity primary key,
  name           text not null,
  tagline        text,                      -- optional one-line subtitle on the card
  price          integer not null,          -- original price (IDR), e.g. 50000
  discount_price integer,                    -- sale price (IDR), e.g. 30000; null = no sale
  period         text default 'month',
  features       text[] default '{}',
  active         boolean not null default true,
  sort           integer not null default 0,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- announcements — banner messages, pushed live to the site via Realtime.
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id         bigint generated always as identity primary key,
  message    text not null,
  level      text not null default 'info' check (level in ('info','warn','success')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- settings — singleton (id = 1): bank + telegram + toggles. Public-readable.
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id             integer primary key default 1 check (id = 1),
  bank_name      text default 'SeaBank',
  bank_account   text default '901561211717',
  bank_holder    text default 'Cokorda Bagus Yudhistira P.',
  telegram_dev   text default 'noisy05',
  telegram_support text default 'bloodskil2',
  free_limit     integer not null default 3,
  updated_at     timestamptz not null default now()
);

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.admins        enable row level security;
alter table public.profiles      enable row level security;
alter table public.ip_usage      enable row level security;
alter table public.deployments   enable row level security;
alter table public.payments      enable row level security;
alter table public.products      enable row level security;
alter table public.announcements enable row level security;
alter table public.settings      enable row level security;

-- admins: only admins may read the allowlist; no client writes (manage via SQL).
drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select using (public.is_admin());

-- profiles: anyone may READ (site needs to show a user's plan). Writes: admin only.
-- (The Edge Functions use the service role, which bypasses RLS entirely.)
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- ip_usage: no client access at all except admins (service role bypasses RLS).
-- Admins may read and reset counters (to clear a false-block on a shared IP).
drop policy if exists ip_usage_admin_read on public.ip_usage;
create policy ip_usage_admin_read on public.ip_usage for select using (public.is_admin());
drop policy if exists ip_usage_admin_write on public.ip_usage;
create policy ip_usage_admin_write on public.ip_usage for all
  using (public.is_admin()) with check (public.is_admin());

-- deployments: admin may read; inserts happen via service role.
drop policy if exists deployments_admin_read on public.deployments;
create policy deployments_admin_read on public.deployments for select using (public.is_admin());

-- payments: a user may INSERT their own pending proof; admin may read/update all.
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert
  with check (status = 'pending');
drop policy if exists payments_admin_read on public.payments;
create policy payments_admin_read on public.payments for select using (public.is_admin());
drop policy if exists payments_admin_update on public.payments;
create policy payments_admin_update on public.payments for update
  using (public.is_admin()) with check (public.is_admin());

-- products: public read (only active ones matter to the site); admin writes.
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (true);
drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products for all
  using (public.is_admin()) with check (public.is_admin());

-- announcements: public read; admin writes.
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select using (true);
drop policy if exists announcements_admin_write on public.announcements;
create policy announcements_admin_write on public.announcements for all
  using (public.is_admin()) with check (public.is_admin());

-- settings: public read; admin writes.
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

-- payment_methods: public read (buyers need to see how to pay); admin writes.
alter table public.payment_methods enable row level security;
drop policy if exists payment_methods_read on public.payment_methods;
create policy payment_methods_read on public.payment_methods for select using (true);
drop policy if exists payment_methods_admin_write on public.payment_methods;
create policy payment_methods_admin_write on public.payment_methods for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Storage — 'proofs' holds payment screenshots; 'assets' holds admin images
-- (QR codes for payment methods).
-- Create both buckets first (Dashboard -> Storage, public, image-only, ~5 MB)
-- OR they are created in SETUP.md. A "public" bucket only makes objects
-- downloadable; uploading still needs an explicit INSERT policy, or the browser
-- (anon key) gets "new row violates row-level security policy".
-- ----------------------------------------------------------------------------
-- proofs: anyone may upload their transfer proof (insert only); public read.
drop policy if exists "proofs_public_upload" on storage.objects;
create policy "proofs_public_upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'proofs');

-- assets: public read; only admins may upload/replace/remove (QR images etc.).
drop policy if exists "assets_public_read" on storage.objects;
create policy "assets_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'assets');
drop policy if exists "assets_admin_insert" on storage.objects;
create policy "assets_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'assets' and public.is_admin());
drop policy if exists "assets_admin_update" on storage.objects;
create policy "assets_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'assets' and public.is_admin())
  with check (bucket_id = 'assets' and public.is_admin());
drop policy if exists "assets_admin_delete" on storage.objects;
create policy "assets_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'assets' and public.is_admin());

-- ============================================================================
-- Realtime — let the site subscribe to live pricing + announcement changes.
-- ============================================================================
alter publication supabase_realtime add table public.announcements;
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.payment_methods;

-- ============================================================================
-- Seed defaults (only if empty)
-- ============================================================================
insert into public.settings (id) values (1) on conflict (id) do nothing;

insert into public.payment_methods (label, kind, account, holder, instructions, active, sort)
select 'SeaBank', 'bank', '901561211717', 'Cokorda Bagus Yudhistira P.',
       'Transfer the exact amount, then upload your receipt.', true, 0
where not exists (select 1 from public.payment_methods);

insert into public.products (name, price, discount_price, period, features, active, sort)
select 'Premium', 50000, 30000, 'month',
       array[
         'Unlimited deploys',
         'Deploy to private repositories',
         'Early access to new features',
         'Deploy history synced across your devices',
         'Larger file size limit',
         'Premium badge',
         'Priority support on Telegram'
       ],
       true, 0
where not exists (select 1 from public.products);

-- ----------------------------------------------------------------------------
-- IMPORTANT — after creating your two admin users in Authentication -> Users,
-- register their emails and their GitHub logins here so they get unlimited use.
-- Replace the placeholder emails/logins, then run these lines:
--
--   insert into public.admins (email, name) values
--     ('noisy@example.com', 'Noisy'),
--     ('bloodskill@example.com', 'BloodSkill')
--   on conflict (email) do nothing;
--
--   insert into public.profiles (github_login, plan) values
--     ('NOISY_GITHUB_LOGIN', 'developer'),
--     ('BLOODSKILL_GITHUB_LOGIN', 'developer')
--   on conflict (github_login) do update set plan = 'developer';
-- ----------------------------------------------------------------------------
