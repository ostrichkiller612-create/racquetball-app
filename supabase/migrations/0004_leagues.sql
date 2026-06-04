-- Leagues
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index leagues_created_by_idx on public.leagues (created_by);

alter table public.leagues enable row level security;

-- League members (placeholder users get user_id = null until they sign up)
create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  seed_number int not null,
  name text not null,
  phone text,
  email text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (league_id, seed_number)
);

create index league_members_user_idx on public.league_members (user_id);
create index league_members_email_idx on public.league_members (email);

alter table public.league_members enable row level security;

-- Helper: am I a member of league X
create or replace function public.is_league_member(p_league uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league and user_id = auth.uid()
  );
$$;

-- League policies
create policy "leagues_select_if_member"
  on public.leagues for select
  to authenticated
  using (
    public.is_league_member(id) or created_by = auth.uid()
  );

create policy "leagues_insert_any_authenticated"
  on public.leagues for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "leagues_update_creator"
  on public.leagues for update
  to authenticated
  using (created_by = auth.uid());

create policy "leagues_delete_creator"
  on public.leagues for delete
  to authenticated
  using (created_by = auth.uid());

-- League member policies
create policy "league_members_select_if_member"
  on public.league_members for select
  to authenticated
  using (
    public.is_league_member(league_id)
    or exists (select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid())
  );

create policy "league_members_insert_admin"
  on public.league_members for insert
  to authenticated
  with check (
    exists (select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid())
    or exists (
      select 1 from public.league_members
      where league_id = league_members.league_id and user_id = auth.uid() and role = 'admin'
    )
  );

create policy "league_members_update_admin"
  on public.league_members for update
  to authenticated
  using (
    exists (select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid())
    or exists (
      select 1 from public.league_members lm2
      where lm2.league_id = league_members.league_id and lm2.user_id = auth.uid() and lm2.role = 'admin'
    )
  );

create policy "league_members_delete_admin"
  on public.league_members for delete
  to authenticated
  using (
    exists (select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid())
    or exists (
      select 1 from public.league_members lm2
      where lm2.league_id = league_members.league_id and lm2.user_id = auth.uid() and lm2.role = 'admin'
    )
  );

-- Trigger: link placeholder rows when a new user signs up with a matching email
create or replace function public.link_new_user_to_league_members()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.league_members
  set user_id = new.id
  where user_id is null and lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_new_user_to_league_members();
