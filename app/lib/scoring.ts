// app/lib/scoring.ts

import type { PlayerScore, RosterSlot, WeekSchedule, Matchup, FantasyTeam, TeamRecord, Player, PllDoubleHeader } from '../types'

export interface RosterSnapshot {
  team_id: number
  week: number
  slot_index: number
  player_id: number | null
}

/**
 * Get a player's score for a given week.
 * Averages game A and B if the player's PLL team has a double-header that week.
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
 * Get the effective roster for a team in a given week.
 * Uses snapshot for past weeks, live roster for current/future weeks.
 */
export function getRosterForWeek(
  teamId: number,
  week: number,
  currentWeek: number,
  liveRoster: RosterSlot[],
  snapshots: RosterSnapshot[]
): Array<{ slot_index: number; player_id: number | null }> {
  if (week < currentWeek) {
    // Use snapshot for completed weeks
    const snap = snapshots.filter(s => s.team_id === teamId && s.week === week)
    if (snap.length > 0) return snap
    // Fall back to live roster if no snapshot exists (e.g. week 1 before snapshots were introduced)
    return liveRoster.filter(r => r.team_id === teamId && r.slot_index <= 9)
  }
  // Use live roster for current week
  return liveRoster.filter(r => r.team_id === teamId && r.slot_index <= 9)
}

/**
 * Get total fantasy points for a team in a given week.
 * Only counts the 10 starting slots (indices 0–9).
 */
export function getTeamWeekScore(
  teamId: number,
  week: number,
  liveRoster: RosterSlot[],
  scores: PlayerScore[],
  players: Player[],
  pllDoubleHeaders: PllDoubleHeader[],
  currentWeek: number = week,
  snapshots: RosterSnapshot[] = []
): number {
  const roster = getRosterForWeek(teamId, week, currentWeek, liveRoster, snapshots)
  const starters = roster.filter(r => r.slot_index <= 9 && r.player_id !== null)

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
  liveRoster: RosterSlot[],
  scores: PlayerScore[],
  players: Player[],
  schedule: WeekSchedule[],
  matchups: Matchup[],
  pllDoubleHeaders: PllDoubleHeader[],
  currentWeek: number = upToWeek + 1,
  snapshots: RosterSnapshot[] = []
): { wins: number; losses: number; points_for: number } {
  let wins = 0, losses = 0, points_for = 0

  for (let wk = 1; wk <= Math.min(upToWeek, 8); wk++) {
    const wkData = schedule.find(s => s.week === wk)
    if (!wkData || wkData.week_type !== 'regular') continue

    const matchup = matchups.find(m => m.week === wk && (m.home_team_id === teamId || m.away_team_id === teamId))
    if (!matchup) continue

    const oppId = matchup.home_team_id === teamId ? matchup.away_team_id : matchup.home_team_id

    const myScore = getTeamWeekScore(teamId, wk, liveRoster, scores, players, pllDoubleHeaders, currentWeek, snapshots)
    const oppScore = getTeamWeekScore(oppId, wk, liveRoster, scores, players, pllDoubleHeaders, currentWeek, snapshots)

    points_for += myScore
    if (myScore > oppScore) wins++
    else losses++
  }

  return { wins, losses, points_for: Math.round(points_for * 100) / 100 }
}

/**
 * Get full standings: all teams ranked by wins, tiebreaker = points for.
 * Used both for final playoff seeding and for live "if the season ended today" projections.
 */
export function getFullStandings(
  teams: FantasyTeam[],
  liveRoster: RosterSlot[],
  scores: PlayerScore[],
  players: Player[],
  schedule: WeekSchedule[],
  matchups: Matchup[],
  pllDoubleHeaders: PllDoubleHeader[],
  currentWeek: number = 9,
  snapshots: RosterSnapshot[] = []
): TeamRecord[] {
  const records: TeamRecord[] = teams.map(team => {
    const rec = calcTeamRecord(team.id, 8, liveRoster, scores, players, schedule, matchups, pllDoubleHeaders, currentWeek, snapshots)
    return { team, ...rec }
  })

  return records.sort((a, b) => b.wins - a.wins || b.points_for - a.points_for)
}

/**
 * Get playoff seeds: top 4 teams by wins, tiebreaker = points for.
 */
export function getPlayoffSeeds(
  teams: FantasyTeam[],
  liveRoster: RosterSlot[],
  scores: PlayerScore[],
  players: Player[],
  schedule: WeekSchedule[],
  matchups: Matchup[],
  pllDoubleHeaders: PllDoubleHeader[],
  currentWeek: number = 9,
  snapshots: RosterSnapshot[] = []
): TeamRecord[] {
  return getFullStandings(teams, liveRoster, scores, players, schedule, matchups, pllDoubleHeaders, currentWeek, snapshots).slice(0, 4)
}
