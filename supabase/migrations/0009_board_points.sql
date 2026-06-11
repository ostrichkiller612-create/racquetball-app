-- Official handwritten board totals, captured per member.
alter table public.league_members
  add column board_points int,
  add column board_updated_at timestamptz;
