-- Broaden matches policies: league members can read and write matches in their leagues.

drop policy if exists "matches_owner_select" on public.matches;
drop policy if exists "matches_owner_insert" on public.matches;
drop policy if exists "matches_owner_update" on public.matches;
drop policy if exists "matches_owner_delete" on public.matches;

create policy "matches_select_owner_or_league"
  on public.matches for select to authenticated
  using (
    entered_by = auth.uid()
    or (league_id is not null and public.is_league_member(league_id))
  );

create policy "matches_insert_owner_or_league"
  on public.matches for insert to authenticated
  with check (
    entered_by = auth.uid()
    and (
      league_id is null
      or public.is_league_member(league_id)
    )
  );

create policy "matches_update_entered_by"
  on public.matches for update to authenticated
  using (entered_by = auth.uid());

create policy "matches_delete_entered_by"
  on public.matches for delete to authenticated
  using (entered_by = auth.uid());

-- Add FK constraint now that leagues exists
alter table public.matches
  add constraint matches_league_id_fk
  foreign key (league_id) references public.leagues(id) on delete set null;
