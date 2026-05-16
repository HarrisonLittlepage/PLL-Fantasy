// app/lib/scoring.ts

import type { PlayerScore, RosterSlot, WeekSchedule, Matchup, FantasyTeam, TeamRecord, Player, PllDoubleHeader } from '../types'

/**
 * Get a player's score for a given week.
 * If the player's PLL team has a double-header that week, averages game A and B.
 * Uses Number() coercion because Supabase returns numeric columns as strings.
 */
export function getPlayerWeekScore(
  playerId: number,
  week: number,
  scores: PlayerScore[],
  players: Player[],
  pllDoubleHeaders: PllDoubleHeader[]
): number {
  const gameA = Number(scores.find(s => s.player_id === playerId && s.week === week && s.game === 'A')?.points ?? 0)
  const gameBRaw = scores.find(s => s.player_id === playerId && s.week === week && s.game === 'B')?.points
  const gameB = gameBRaw !== undefined ? Number(gameBRaw) : null

  const player = players.find(p => p.id === playerId)
  const isDoubleHeader = player
    ? pllDoubleHeaders.some(dh => dh.week === week && dh.pll_team === player.pll_team)
    : false

  if (!isDoubleHeader || gameB === null) return gameA

  return (gameA + gameB) / 2
}

/**
 * Get total fantasy points for a team in a given week.
 * Only counts the 10 starting slots (indices 0–9).
 */
export function getTeamWeekScore(
  teamId: number,
  week: number,
  roster: RosterSlot[],
  scores: PlayerScore[],
  players: Player[],
  pllDoubleHeaders: PllDoubleHeader[]
): number {
  const starters = roster.filter(
    slot => slot.team_id === teamId && slot.slot_index < 10 && slot.player_id !== null
  )

  return starters.reduce((total, slot) => {
    return total + getPlayerWeekScore(slot.player_id!, week, scores, players, pllDoubleHeaders)
  }, 0)
}

/**
 * Calculate win/loss record and points for a team up to (not including) a given week.
 */
export function calcTeamRecord(
  teamId: number,
  upToWeek: number,
  roster: RosterSlot[],
  scores: PlayerScore[],
  players: Player[],
  schedule: WeekSchedule[],
  matchups: Matchup[],
  pllDoubleHeaders: PllDoubleHeader[]
): { wins: number; losses: number; points_for: number } {
  let wins = 0, losses = 0, points_for = 0

  for (let wk = 1; wk <= Math.min(upToWeek, 8); wk++) {
    const wkData = schedule.find(s => s.week === wk)
    if (!wkData || wkData.week_type !== 'regular') continue

    const matchup = matchups.find(m => m.week === wk && (m.home_team_id === teamId || m.away_team_id === teamId))
    if (!matchup) continue

    const oppId = matchup.home_team_id === teamId ? matchup.away_team_id : matchup.home_team_id

    const myScore = getTeamWeekScore(teamId, wk, roster, scores, players, pllDoubleHeaders)
    const oppScore = getTeamWeekScore(oppId, wk, roster, scores, players, pllDoubleHeaders)

    points_for += myScore
    if (myScore > oppScore) wins++
    else losses++
  }

  return { wins, losses, points_for: Math.round(points_for * 100) / 100 }
}

/**
 * Get playoff seeds: top 4 teams by wins, tiebreaker = points for.
 */
export function getPlayoffSeeds(
  teams: FantasyTeam[],
  roster: RosterSlot[],
  scores: PlayerScore[],
  players: Player[],
  schedule: WeekSchedule[],
  matchups: Matchup[],
  pllDoubleHeaders: PllDoubleHeader[]
): TeamRecord[] {
  const records: TeamRecord[] = teams.map(team => {
    const rec = calcTeamRecord(team.id, 8, roster, scores, players, schedule, matchups, pllDoubleHeaders)
    return { team, ...rec }
  })

  return records
    .sort((a, b) => b.wins - a.wins || b.points_for - a.points_for)
    .slice(0, 4)
}
