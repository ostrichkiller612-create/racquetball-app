create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  linked_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index contacts_owner_idx on public.contacts (owner_id);

alter table public.contacts enable row level security;

create policy "contacts_owner_all"
  on public.contacts for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
