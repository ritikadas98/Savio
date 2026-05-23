-- 0002_commitments_and_goals.sql

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  label text not null,
  amount numeric(10,2) not null,
  frequency text check (frequency in ('monthly','quarterly','annual','irregular')) default 'monthly',
  category text,
  next_due_date date,
  source text check (source in ('detected_from_statement','user_added','manual')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  label text not null,
  target_amount numeric(10,2) not null,
  current_amount numeric(10,2) default 0,
  target_date date,
  monthly_contribution numeric(10,2),
  status text check (status in ('active','paused','achieved','abandoned')) default 'active',
  priority integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS for commitments
alter table public.commitments enable row level security;
create policy "users read own commitments" on public.commitments for select using (
  exists (select 1 from public.profiles where id = commitments.user_id and auth_user_id = auth.uid())
);
create policy "users insert own commitments" on public.commitments for insert with check (
  exists (select 1 from public.profiles where id = commitments.user_id and auth_user_id = auth.uid())
);
create policy "users update own commitments" on public.commitments for update using (
  exists (select 1 from public.profiles where id = commitments.user_id and auth_user_id = auth.uid())
);
create policy "users delete own commitments" on public.commitments for delete using (
  exists (select 1 from public.profiles where id = commitments.user_id and auth_user_id = auth.uid())
);

-- RLS for goals
alter table public.goals enable row level security;
create policy "users read own goals" on public.goals for select using (
  exists (select 1 from public.profiles where id = goals.user_id and auth_user_id = auth.uid())
);
create policy "users insert own goals" on public.goals for insert with check (
  exists (select 1 from public.profiles where id = goals.user_id and auth_user_id = auth.uid())
);
create policy "users update own goals" on public.goals for update using (
  exists (select 1 from public.profiles where id = goals.user_id and auth_user_id = auth.uid())
);
create policy "users delete own goals" on public.goals for delete using (
  exists (select 1 from public.profiles where id = goals.user_id and auth_user_id = auth.uid())
);

-- Triggers
create trigger update_commitments_updated_at
  before update on public.commitments
  for each row execute procedure public.update_updated_at_column();

create trigger update_goals_updated_at
  before update on public.goals
  for each row execute procedure public.update_updated_at_column();

-- Indexes
create index idx_commitments_user_id on public.commitments(user_id);
create index idx_goals_user_id on public.goals(user_id);
