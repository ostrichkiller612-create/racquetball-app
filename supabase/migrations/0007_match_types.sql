alter table public.matches
  add column match_type text not null default 'singles'
    check (match_type in ('singles', 'cutthroat', 'doubles')),
  add column player3_user_id uuid references auth.users(id) on delete set null,
  add column player3_contact_id uuid references public.contacts(id) on delete set null,
  add column player4_user_id uuid references auth.users(id) on delete set null,
  add column player4_contact_id uuid references public.contacts(id) on delete set null,
  add column winner_position smallint;

alter table public.matches
  drop constraint if exists matches_player1_exclusive,
  drop constraint if exists matches_player2_exclusive,
  drop constraint if exists matches_not_self,
  drop constraint if exists matches_no_draws;

alter table public.matches
  add constraint matches_player1_xor
    check ((player1_user_id is not null)::int + (player1_contact_id is not null)::int = 1),
  add constraint matches_player2_xor
    check ((player2_user_id is not null)::int + (player2_contact_id is not null)::int = 1),
  add constraint matches_player3_xor
    check (
      match_type = 'singles'
      or (player3_user_id is not null)::int + (player3_contact_id is not null)::int = 1
    ),
  add constraint matches_player4_xor
    check (
      match_type in ('singles', 'cutthroat')
      or (player4_user_id is not null)::int + (player4_contact_id is not null)::int = 1
    );

alter table public.matches
  add constraint matches_singles_rules check (
    match_type <> 'singles'
    or (
      player3_user_id is null and player3_contact_id is null
      and player4_user_id is null and player4_contact_id is null
      and winner_position is null
      and player1_games_won <> player2_games_won
    )
  ),
  add constraint matches_cutthroat_rules check (
    match_type <> 'cutthroat'
    or (
      player4_user_id is null and player4_contact_id is null
      and winner_position in (1, 2, 3)
      and league_id is null
    )
  ),
  add constraint matches_doubles_rules check (
    match_type <> 'doubles'
    or (
      winner_position in (1, 2)
      and league_id is null
    )
  );
