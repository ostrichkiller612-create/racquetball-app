# League Usability Batch — Design

**Date:** 2026-06-05
**Owner:** Jim Herrington

Four small features that make the app shareable with the league and remove daily friction.

## 1. Claim your roster spot

**Problem:** New signups only auto-link to their roster row by email, but the imported roster has phones, not emails. A league member who signs up today is disconnected from their seed, schedule, and history.

**Flow:**
- League page gets an **Invite** card (visible to all members): QR code + copyable link to `{origin}/join/{leagueId}`.
- `/join/:leagueId` is reachable WITHOUT auth:
  - Signed out: stores `pendingJoinLeague` in localStorage, sends to `/signin`. After auth, the app shell sees the pending id and navigates back to `/join/:id`.
  - Signed in: shows the league name + list of unclaimed roster names ("Which one are you?"). Tap a name → instant claim → land on the league page.
- Claiming is trust-based (consistent with anyone-can-enter matches). Admin can remove a wrong claim from the roster.

**Backend (migration 0010, SECURITY DEFINER RPCs — needed because non-members can't read leagues/league_members under RLS):**

- `get_league_join_info(p_league uuid)` → `{ league_name, members: [{id, seed_number, name, claimed}] }` for any authenticated caller.
- `claim_league_member(p_member uuid)` → sets `user_id = auth.uid()` where currently null; rejects when the caller already has a member row in that league; returns league_id.

## 2. Edit / delete matches

- Rows in MatchHistory become links to `/matches/:id`.
- Edit screen: shows match details. If `entered_by = me`: editable date, scores (singles) or winner (cutthroat/doubles), notes, Save + Delete buttons. Otherwise read-only.
- RLS already permits update/delete by `entered_by` — no migration needed.

## 3. Edit league members

- Roster rows get an **Edit** action (admin): opens the existing MemberForm pre-filled (seed, name, phone, email), Save updates the row.
- `useLeagueMembers` gains `updateMember(id, patch)`.
- RLS already permits admin updates.

## 4. Auto-link matches to schedule on save

- After a league match insert, fire `auto_link_match(p_match uuid)` (SECURITY DEFINER RPC, same migration): finds the unlinked schedule row in that league where both match players' user_ids equal the row's members (either order) and the date is within ±3 days; closest date wins; sets `match_id`.
- RPC needed because non-admin members can't update `league_schedule` under RLS.
- Fire-and-forget from `addMatch` — a failed link never blocks saving the match.
- The manual 🔗 screen stays for back-filling and contact-based opponents (the RPC only handles user-vs-user since it can't see private contacts).

## Files

```
supabase/migrations/0010_claim_and_autolink.sql
src/leagues/JoinLeague.tsx        # /join/:leagueId (outside ProtectedRoute)
src/leagues/InviteCard.tsx        # QR + copy link, on League page
src/leagues/League.tsx            # MODIFIED: invite card + member edit
src/leagues/useLeagueMembers.ts   # MODIFIED: updateMember
src/leagues/MemberForm.tsx        # MODIFIED: optional initial values
src/matches/EditMatch.tsx         # /matches/:id
src/matches/MatchHistory.tsx      # MODIFIED: rows link to edit screen
src/matches/useMatches.ts         # MODIFIED: auto-link RPC call after insert
src/shell/AppShell.tsx            # MODIFIED: pendingJoinLeague redirect + routes
src/App.tsx                       # MODIFIED: /join route outside ProtectedRoute
```

## Testing

- Existing suite must stay green (CI).
- Manual: claim flow end-to-end with a second account; edit + delete a match; edit a member; log a league match against a claimed member and confirm the schedule row links itself.

## Out of scope

- Admin approval queue for claims.
- Editing cutthroat/doubles participants (only winner + notes editable).
- Un-claim UI (admin removes + re-adds the member row).
