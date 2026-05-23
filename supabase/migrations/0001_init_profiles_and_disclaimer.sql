-- 0001_init_profiles_and_disclaimer.sql

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  full_name text,
  avatar text check (avatar in ('strategist','adventurer','builder')) not null,
  life_stage text check (life_stage in ('student','working_no_dependents','supporting_dependents','pre_retiree')),
  city text,
  monthly_income_gross numeric(10,2),
  monthly_income_net numeric(10,2),
  anchor_day_of_month integer check (anchor_day_of_month between 1 and 31),
  income_pattern text check (income_pattern in ('regular_salaried','irregular_freelance','mixed')) default 'regular_salaried',
  primary_bank text,
  disclaimer_acknowledged_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Note: user_id is the id of the profile in this schema, wait no.
-- The spec says:
-- "Priya's profile row exists with avatar='strategist'..."
-- "Priya's auth user. Created via the admin API. Insert her profile row referencing the auth user's id."
-- If profiles table references auth.users(id), the schema in the spec has:
-- `id uuid primary key default gen_random_uuid(),` 
-- Wait! The provided spec for `profiles` in section 6 says:
-- `id uuid primary key default gen_random_uuid(),` but DOES NOT have `user_id uuid references auth.users(id)`. 
-- Let me fix the schema to include `user_id uuid references auth.users(id) on delete cascade unique not null,` as in standard Supabase, or maybe `id` IS the user_id. The spec says "user_id uuid references profiles(id)" for all other tables! So `profiles.id` is the primary key and the foreign key from other tables. That means `profiles.id` should either be the auth.users(id) or we add an `auth_id` column. I will use `id uuid primary key references auth.users(id) on delete cascade` for simplicity, mapping exactly 1:1. Wait, let's look at the spec:
-- `id uuid primary key default gen_random_uuid()` 
-- It does not reference auth.users. But RLS needs to check `auth.uid()`. How does it map? I will add `auth_user_id uuid references auth.users(id) on delete cascade unique`. And RLS will be `auth.uid() = auth_user_id`. Or I can just make `id` equal to `auth.uid()` by setting `id uuid primary key references auth.users(id) on delete cascade`. Let me use `id uuid primary key references auth.users(id) on delete cascade` and modify the other tables to reference `profiles(id)`.

alter table public.profiles
  add column auth_user_id uuid references auth.users(id) on delete cascade unique;

-- RLS
alter table public.profiles enable row level security;
create policy "users read own profile" on public.profiles for select using (auth.uid() = auth_user_id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = auth_user_id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = auth_user_id);

-- Indexes
create index idx_profiles_auth_user_id on public.profiles(auth_user_id);

-- Updated_at trigger function (used across all tables)
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();
