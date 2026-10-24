-- 0001_saves: cloud save tables for MalaRimThang. Idempotent; safe to re-run.

-- Profiles: one row per auth user (anonymous or Google).
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  shop_name text,
  created_at timestamptz default now()
);

-- Saves: one JSON game state per user, with size and shape guards.
create table if not exists public.saves (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  version int not null,
  day int not null,
  updated_at timestamptz not null default now(),
  constraint saves_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint saves_data_size check (pg_column_size(data) < 200000)
);

-- Index for sorting/cleanup by recency.
create index if not exists saves_updated_at_idx on public.saves (updated_at);

-- Trigger keeps updated_at fresh on every update.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists saves_touch_updated_at on public.saves;
create trigger saves_touch_updated_at before update on public.saves
  for each row execute function public.touch_updated_at();

-- Row level security: each user sees and changes only their own rows.
alter table public.profiles enable row level security;
alter table public.saves enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

drop policy if exists "saves_select_own" on public.saves;
create policy "saves_select_own" on public.saves for select using (auth.uid() = user_id);
drop policy if exists "saves_insert_own" on public.saves;
create policy "saves_insert_own" on public.saves for insert with check (auth.uid() = user_id);
drop policy if exists "saves_update_own" on public.saves;
create policy "saves_update_own" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "saves_delete_own" on public.saves;
create policy "saves_delete_own" on public.saves for delete using (auth.uid() = user_id);
