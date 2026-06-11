-- The original league_members policies queried league_members directly inside
-- the policy's WITH CHECK / USING clauses. Postgres flags that as recursion.
-- Wrap the "is admin of this league" test in a SECURITY DEFINER function so
-- the inner query bypasses RLS.

create or replace function public.is_league_admin(p_league uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.leagues l
    where l.id = p_league and l.created_by = auth.uid()
  ) or exists (
    select 1 from public.league_members
    where league_id = p_league and user_id = auth.uid() and role = 'admin'
  );
$$;

-- Drop the recursive policies and recreate using the function.
drop policy if exists "league_members_insert_admin" on public.league_members;
drop policy if exists "league_members_update_admin" on public.league_members;
drop policy if exists "league_members_delete_admin" on public.league_members;

create policy "league_members_insert_admin"
  on public.league_members for insert to authenticated
  with check (public.is_league_admin(league_id));

create policy "league_members_update_admin"
  on public.league_members for update to authenticated
  using (public.is_league_admin(league_id));

create policy "league_members_delete_admin"
  on public.league_members for delete to authenticated
  using (public.is_league_admin(league_id));
