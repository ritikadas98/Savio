-- 0004_rituals_and_windfalls.sql

create table public.monthly_rituals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  month_year text not null,
  status text check (status in ('pending','completed','skipped','carried_forward')) default 'pending',
  income_confirmed numeric(10,2),
  commitments_confirmed boolean default false,
  focus_goal_id uuid references public.goals(id) on delete set null,
  safe_to_spend_locked numeric(10,2),
  completed_at timestamptz,
  carried_forward_from uuid references public.monthly_rituals(id) on delete set null,
  created_at timestamptz default now(),
  unique(user_id, month_year)
);

create table public.windfalls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  amount numeric(10,2) not null,
  detected_at timestamptz default now(),
  status text check (status in ('pending_allocation','allocated','dismissed')) default 'pending_allocation',
  allocations jsonb,
  allocated_at timestamptz,
  created_at timestamptz default now()
);

-- RLS for monthly_rituals
alter table public.monthly_rituals enable row level security;
create policy "users read own monthly_rituals" on public.monthly_rituals for select using (
  exists (select 1 from public.profiles where id = monthly_rituals.user_id and auth_user_id = auth.uid())
);
create policy "users insert own monthly_rituals" on public.monthly_rituals for insert with check (
  exists (select 1 from public.profiles where id = monthly_rituals.user_id and auth_user_id = auth.uid())
);
create policy "users update own monthly_rituals" on public.monthly_rituals for update using (
  exists (select 1 from public.profiles where id = monthly_rituals.user_id and auth_user_id = auth.uid())
);
create policy "users delete own monthly_rituals" on public.monthly_rituals for delete using (
  exists (select 1 from public.profiles where id = monthly_rituals.user_id and auth_user_id = auth.uid())
);

-- RLS for windfalls
alter table public.windfalls enable row level security;
create policy "users read own windfalls" on public.windfalls for select using (
  exists (select 1 from public.profiles where id = windfalls.user_id and auth_user_id = auth.uid())
);
create policy "users insert own windfalls" on public.windfalls for insert with check (
  exists (select 1 from public.profiles where id = windfalls.user_id and auth_user_id = auth.uid())
);
create policy "users update own windfalls" on public.windfalls for update using (
  exists (select 1 from public.profiles where id = windfalls.user_id and auth_user_id = auth.uid())
);
create policy "users delete own windfalls" on public.windfalls for delete using (
  exists (select 1 from public.profiles where id = windfalls.user_id and auth_user_id = auth.uid())
);

-- Indexes
create index idx_monthly_rituals_user_id on public.monthly_rituals(user_id);
create index idx_monthly_rituals_focus_goal_id on public.monthly_rituals(focus_goal_id);
create index idx_windfalls_user_id on public.windfalls(user_id);
create index idx_windfalls_transaction_id on public.windfalls(transaction_id);
