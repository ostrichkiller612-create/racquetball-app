import type { NewMatchInput } from './useMatches'

export type MatchRow = {
  match_type: 'singles' | 'cutthroat' | 'doubles'
  league_id: string | null
  match_date: string
  player1_user_id: string | null
  player1_contact_id: string | null
  player2_user_id: string | null
  player2_contact_id: string | null
  player3_user_id: string | null
  player3_contact_id: string | null
  player4_user_id: string | null
  player4_contact_id: string | null
  player1_games_won: number
  player2_games_won: number
  winner_position: number | null
  notes: string | null
  entered_by: string
}

function slot(userId?: string | null, contactId?: string | null) {
  if (userId) return { user_id: userId, contact_id: null }
  return { user_id: null, contact_id: contactId ?? null }
}

export function buildMatchRow(input: NewMatchInput, me: string): MatchRow {
  if (input.type === 'singles') {
    const opp = slot(input.opponent_user_id, input.opponent_contact_id)
    return {
      match_type: 'singles',
      league_id: input.league_id ?? null,
      match_date: input.match_date,
      player1_user_id: me,
      player1_contact_id: null,
      player2_user_id: opp.user_id,
      player2_contact_id: opp.contact_id,
      player3_user_id: null,
      player3_contact_id: null,
      player4_user_id: null,
      player4_contact_id: null,
      player1_games_won: input.your_games,
      player2_games_won: input.their_games,
      winner_position: null,
      notes: input.notes,
      entered_by: me,
    }
  }
  if (input.type === 'cutthroat') {
    const opp1 = slot(input.opp1_user_id, input.opp1_contact_id)
    const opp2 = slot(input.opp2_user_id, input.opp2_contact_id)
    const winnerPos = input.winner === 'me' ? 1 : input.winner === 'opp1' ? 2 : 3
    return {
      match_type: 'cutthroat',
      league_id: null,
      match_date: input.match_date,
      player1_user_id: me,
      player1_contact_id: null,
      player2_user_id: opp1.user_id,
      player2_contact_id: opp1.contact_id,
      player3_user_id: opp2.user_id,
      player3_contact_id: opp2.contact_id,
      player4_user_id: null,
      player4_contact_id: null,
      player1_games_won: 0,
      player2_games_won: 0,
      winner_position: winnerPos,
      notes: input.notes,
      entered_by: me,
    }
  }
  const partner = slot(input.partner_user_id, input.partner_contact_id)
  const opp1 = slot(input.opp1_user_id, input.opp1_contact_id)
  const opp2 = slot(input.opp2_user_id, input.opp2_contact_id)
  return {
    match_type: 'doubles',
    league_id: null,
    match_date: input.match_date,
    player1_user_id: me,
    player1_contact_id: null,
    player2_user_id: partner.user_id,
    player2_contact_id: partner.contact_id,
    player3_user_id: opp1.user_id,
    player3_contact_id: opp1.contact_id,
    player4_user_id: opp2.user_id,
    player4_contact_id: opp2.contact_id,
    player1_games_won: 0,
    player2_games_won: 0,
    winner_position: input.winning_team === 'mine' ? 1 : 2,
    notes: input.notes,
    entered_by: me,
  }
}
