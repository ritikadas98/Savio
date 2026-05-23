-- 0003_transactions_and_reflections.sql

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  occurred_at timestamptz not null,
  amount numeric(10,2) not null,
  direction text check (direction in ('credit','debit')) not null,
  merchant text,
  description text,
  category text,
  category_source text check (category_source in ('auto_inferred','user_labeled','unknown')) default 'auto_inferred',
  is_significant boolean default false,
  is_recurring boolean default false,
  commitment_id uuid references public.commitments(id) on delete set null,
  source text check (source in ('statement','sms','manual','seeded_demo')) default 'seeded_demo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  label text check (label in ('glad','regret','neutral')) not null,
  note text,
  reflected_at timestamptz default now(),
  unique(transaction_id)
);

create table public.merchant_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  merchant text not null,
  total_transactions integer default 0,
  total_labeled integer default 0,
  glad_count integer default 0,
  regret_count integer default 0,
  neutral_count integer default 0,
  regret_rate numeric(5,2),
  last_computed_at timestamptz default now(),
  unique(user_id, merchant)
);

-- RLS for transactions
alter table public.transactions enable row level security;
create policy "users read own transactions" on public.transactions for select using (
  exists (select 1 from public.profiles where id = transactions.user_id and auth_user_id = auth.uid())
);
create policy "users insert own transactions" on public.transactions for insert with check (
  exists (select 1 from public.profiles where id = transactions.user_id and auth_user_id = auth.uid())
);
create policy "users update own transactions" on public.transactions for update using (
  exists (select 1 from public.profiles where id = transactions.user_id and auth_user_id = auth.uid())
);
create policy "users delete own transactions" on public.transactions for delete using (
  exists (select 1 from public.profiles where id = transactions.user_id and auth_user_id = auth.uid())
);

-- RLS for reflections
alter table public.reflections enable row level security;
create policy "users read own reflections" on public.reflections for select using (
  exists (select 1 from public.profiles where id = reflections.user_id and auth_user_id = auth.uid())
);
create policy "users insert own reflections" on public.reflections for insert with check (
  exists (select 1 from public.profiles where id = reflections.user_id and auth_user_id = auth.uid())
);
create policy "users update own reflections" on public.reflections for update using (
  exists (select 1 from public.profiles where id = reflections.user_id and auth_user_id = auth.uid())
);
create policy "users delete own reflections" on public.reflections for delete using (
  exists (select 1 from public.profiles where id = reflections.user_id and auth_user_id = auth.uid())
);

-- RLS for merchant_stats
alter table public.merchant_stats enable row level security;
create policy "users read own merchant_stats" on public.merchant_stats for select using (
  exists (select 1 from public.profiles where id = merchant_stats.user_id and auth_user_id = auth.uid())
);
create policy "users insert own merchant_stats" on public.merchant_stats for insert with check (
  exists (select 1 from public.profiles where id = merchant_stats.user_id and auth_user_id = auth.uid())
);
create policy "users update own merchant_stats" on public.merchant_stats for update using (
  exists (select 1 from public.profiles where id = merchant_stats.user_id and auth_user_id = auth.uid())
);
create policy "users delete own merchant_stats" on public.merchant_stats for delete using (
  exists (select 1 from public.profiles where id = merchant_stats.user_id and auth_user_id = auth.uid())
);

-- Triggers
create trigger update_transactions_updated_at
  before update on public.transactions
  for each row execute procedure public.update_updated_at_column();

-- Indexes
create index idx_transactions_user_id on public.transactions(user_id);
create index idx_transactions_occurred_at on public.transactions(occurred_at desc);
create index idx_transactions_commitment_id on public.transactions(commitment_id);
create index idx_reflections_user_id on public.reflections(user_id);
create index idx_merchant_stats_user_id on public.merchant_stats(user_id);
