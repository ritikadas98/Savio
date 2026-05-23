-- 0005_chat_and_decisions.sql

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  role text check (role in ('user','assistant','system')) not null,
  content text not null,
  ai_metadata jsonb,
  created_at timestamptz default now()
);

create table public.saved_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  decision_text text not null,
  verdict text check (verdict in ('green','amber','red')),
  amount numeric(10,2),
  related_message_id uuid references public.chat_messages(id) on delete set null,
  decided_at timestamptz default now(),
  outcome_label text check (outcome_label in ('glad','regret','neutral','pending'))
);

-- RLS for chat_messages
alter table public.chat_messages enable row level security;
create policy "users read own chat_messages" on public.chat_messages for select using (
  exists (select 1 from public.profiles where id = chat_messages.user_id and auth_user_id = auth.uid())
);
create policy "users insert own chat_messages" on public.chat_messages for insert with check (
  exists (select 1 from public.profiles where id = chat_messages.user_id and auth_user_id = auth.uid())
);
create policy "users update own chat_messages" on public.chat_messages for update using (
  exists (select 1 from public.profiles where id = chat_messages.user_id and auth_user_id = auth.uid())
);
create policy "users delete own chat_messages" on public.chat_messages for delete using (
  exists (select 1 from public.profiles where id = chat_messages.user_id and auth_user_id = auth.uid())
);

-- RLS for saved_decisions
alter table public.saved_decisions enable row level security;
create policy "users read own saved_decisions" on public.saved_decisions for select using (
  exists (select 1 from public.profiles where id = saved_decisions.user_id and auth_user_id = auth.uid())
);
create policy "users insert own saved_decisions" on public.saved_decisions for insert with check (
  exists (select 1 from public.profiles where id = saved_decisions.user_id and auth_user_id = auth.uid())
);
create policy "users update own saved_decisions" on public.saved_decisions for update using (
  exists (select 1 from public.profiles where id = saved_decisions.user_id and auth_user_id = auth.uid())
);
create policy "users delete own saved_decisions" on public.saved_decisions for delete using (
  exists (select 1 from public.profiles where id = saved_decisions.user_id and auth_user_id = auth.uid())
);

-- Indexes
create index idx_chat_messages_user_id on public.chat_messages(user_id);
create index idx_saved_decisions_user_id on public.saved_decisions(user_id);
create index idx_saved_decisions_related_message_id on public.saved_decisions(related_message_id);
