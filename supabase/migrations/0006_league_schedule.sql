create table public.league_schedule (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  week_number int not null,
  match_date date not null,
  start_time time,
  court text,
  player1_member_id uuid references public.league_members(id) on delete cascade,
  player2_member_id uuid references public.league_members(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index league_schedule_league_date_idx on public.league_schedule (league_id, match_date);
create index league_schedule_player1_idx on public.league_schedule (player1_member_id);
create index league_schedule_player2_idx on public.league_schedule (player2_member_id);

alter table public.league_schedule enable row level security;

create policy "league_schedule_select_if_member"
  on public.league_schedule for select to authenticated
  using (public.is_league_member(league_id));

create policy "league_schedule_insert_admin"
  on public.league_schedule for insert to authenticated
  with check (exists (
    select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid()
  ));

create policy "league_schedule_update_admin"
  on public.league_schedule for update to authenticated
  using (exists (
    select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid()
  ));

create policy "league_schedule_delete_admin"
  on public.league_schedule for delete to authenticated
  using (exists (
    select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid()
  ));
