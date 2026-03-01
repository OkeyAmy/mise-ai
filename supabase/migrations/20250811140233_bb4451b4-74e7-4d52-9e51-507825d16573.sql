-- 1) Create chat_conversations table for multi-chat support
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text,
  messages jsonb not null default '[]'::jsonb,
  thought_steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.chat_conversations enable row level security;

-- RLS policies (owner-only CRUD)
create policy "Users can view their own conversations"
  on public.chat_conversations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own conversations"
  on public.chat_conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own conversations"
  on public.chat_conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own conversations"
  on public.chat_conversations for delete
  using (auth.uid() = user_id);

-- Trigger to keep updated_at fresh
create trigger update_chat_conversations_updated_at
before update on public.chat_conversations
for each row
execute function public.update_updated_at_column();

-- Helpful indexes
create index if not exists idx_chat_conversations_user_updated
  on public.chat_conversations (user_id, updated_at desc);
