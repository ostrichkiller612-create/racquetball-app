create table public.matches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid,                    -- null = casual; FK added in Plan 3
  match_date date not null,
  player1_user_id uuid references auth.users(id) on delete set null,
  player1_contact_id uuid references public.contacts(id) on delete set null,
  player2_user_id uuid references auth.users(id) on delete set null,
  player2_contact_id uuid references public.contacts(id) on delete set null,
  player1_games_won smallint not null check (player1_games_won >= 0),
  player2_games_won smallint not null check (player2_games_won >= 0),
  notes text,
  entered_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint matches_player1_exclusive check (
    (player1_user_id is not null)::int + (player1_contact_id is not null)::int = 1
  ),
  constraint matches_player2_exclusive check (
    (player2_user_id is not null)::int + (player2_contact_id is not null)::int = 1
  ),
  constraint matches_not_self check (
    player1_user_id is distinct from player2_user_id
    or player1_user_id is null
  ),
  constraint matches_no_draws check (player1_games_won <> player2_games_won)
);

create index matches_entered_by_idx on public.matches (entered_by);
create index matches_date_idx on public.matches (match_date desc);

alter table public.matches enable row level security;

-- For now (Plan 2, solo only): everyone sees / writes only their own matches.
-- Plan 3 will broaden this to include league members.
create policy "matches_owner_select"
  on public.matches for select
  to authenticated
  using (entered_by = auth.uid());

create policy "matches_owner_insert"
  on public.matches for insert
  to authenticated
  with check (entered_by = auth.uid());

create policy "matches_owner_update"
  on public.matches for update
  to authenticated
  using (entered_by = auth.uid());

create policy "matches_owner_delete"
  on public.matches for delete
  to authenticated
  using (entered_by = auth.uid());
