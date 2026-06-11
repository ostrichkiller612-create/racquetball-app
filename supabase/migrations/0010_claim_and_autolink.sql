-- Join info for any authenticated user (non-members can't read these tables
-- under RLS, so this runs as definer).
create or replace function public.get_league_join_info(p_league uuid)
returns json
language sql
security definer
stable
as $$
  select json_build_object(
    'league_name', (select name from public.leagues where id = p_league),
    'members', coalesce((
      select json_agg(json_build_object(
        'id', id,
        'seed_number', seed_number,
        'name', name,
        'claimed', user_id is not null
      ) order by seed_number)
      from public.league_members
      where league_id = p_league
    ), '[]'::json)
  );
$$;

-- Instant claim: attach the caller's account to an unclaimed roster row.
create or replace function public.claim_league_member(p_member uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_league uuid;
begin
  select league_id into v_league
  from public.league_members
  where id = p_member and user_id is null;

  if v_league is null then
    raise exception 'Spot not found or already claimed';
  end if;

  if exists (
    select 1 from public.league_members
    where league_id = v_league and user_id = auth.uid()
  ) then
    raise exception 'You already have a spot in this league';
  end if;

  update public.league_members
  set user_id = auth.uid()
  where id = p_member and user_id is null;

  return v_league;
end;
$$;

-- Auto-link a freshly logged league match to its schedule row. Runs as
-- definer because regular members can't update league_schedule. Only links
-- user-vs-user matches (contacts are private and invisible here).
create or replace function public.auto_link_match(p_match uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_match record;
  v_row_id uuid;
begin
  select * into v_match from public.matches where id = p_match;
  if v_match is null or v_match.league_id is null then
    return null;
  end if;
  if v_match.player1_user_id is null or v_match.player2_user_id is null then
    return null;
  end if;
  -- Only the person who entered the match may trigger linking for it.
  if v_match.entered_by <> auth.uid() then
    return null;
  end if;

  select s.id into v_row_id
  from public.league_schedule s
  join public.league_members m1 on m1.id = s.player1_member_id
  join public.league_members m2 on m2.id = s.player2_member_id
  where s.league_id = v_match.league_id
    and s.match_id is null
    and abs(s.match_date - v_match.match_date) <= 3
    and (
      (m1.user_id = v_match.player1_user_id and m2.user_id = v_match.player2_user_id)
      or
      (m1.user_id = v_match.player2_user_id and m2.user_id = v_match.player1_user_id)
    )
  order by abs(s.match_date - v_match.match_date)
  limit 1;

  if v_row_id is not null then
    update public.league_schedule set match_id = p_match where id = v_row_id;
  end if;

  return v_row_id;
end;
$$;
