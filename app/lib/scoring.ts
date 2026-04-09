// app/lib/scoring.ts
// Pure functions for calculating fantasy scores and standings.
// These run on the server (API routes) and client (display).

import type { PlayerScore, RosterSlot, ByeMode, GameChoice, WeekSchedule, Matchup, FantasyTeam, TeamRecord } from '../types'

/**
 * Get a player's score for a given week.
 * Handles double-header averaging or game picking.
 */
export function getPlayerWeekScore(
  playerId: number,
  week: number,
  scores: PlayerScore[],
  isDoubleHeader: boolean,
  byeMode: ByeMode,
  gamePick: GameChoice = 'A'
): number {
  const gameA = scores.find(s => s.player_id === playerId && s.week === week && s.game === 'A')?.points ?? 0
  const gameB = scores.find(s => s.player_id === playerId && s.week === week && s.game === 'B')?.points ?? 0

  if (!isDoubleHeader) return gameA

  if (byeMode === 'avg') {
    return Math.round((gameA + gameB) / 2)
  } else {
    return gamePick === 'A' ? gameA : gameB
  }
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
  isDoubleHeader: boolean,
  byeMode: ByeMode,
  gamePick: GameChoice = 'A'
): number {
  const starters = roster
    .filter(slot => slot.team_id === teamId && slot.slot_index < 10 && slot.player_id !== null)

  return starters.reduce((total, slot) => {
    return total + getPlayerWeekScore(slot.player_id!, week, scores, isDoubleHeader, byeMode, gamePick)
  }, 0)
}

/**
 * Calculate win/loss record and points for for a team up to (not including) a given week.
 */
export function calcTeamRecord(
  teamId: number,
  upToWeek: number,
  roster: RosterSlot[],
  scores: PlayerScore[],
  schedule: WeekSchedule[],
  matchups: Matchup[],
  byeMode: ByeMode,
  gamePicks: Array<{ team_id: number; week: number; game_choice: GameChoice }>
): { wins: number; losses: number; points_for: number } {
  let wins = 0, losses = 0, points_for = 0

  for (let wk = 1; wk <= Math.min(upToWeek, 10); wk++) {
    const wkData = schedule.find(s => s.week === wk)
    if (!wkData || wkData.week_type !== 'regular') continue
    if (wkData.bye_team_id === teamId) continue // bye week, no record impact

    const matchup = matchups.find(m => m.week === wk && (m.home_team_id === teamId || m.away_team_id === teamId))
    if (!matchup) continue

    const oppId = matchup.home_team_id === teamId ? matchup.away_team_id : matchup.home_team_id
    const isDoubleHeader = wkData.double_team_id === teamId
    const oppIsDouble = wkData.double_team_id === oppId

    const myPick = gamePicks.find(p => p.team_id === teamId && p.week === wk)?.game_choice ?? 'A'
    const oppPick = gamePicks.find(p => p.team_id === oppId && p.week === wk)?.game_choice ?? 'A'

    const myScore = getTeamWeekScore(teamId, wk, roster, scores, isDoubleHeader, byeMode, myPick)
    const oppScore = getTeamWeekScore(oppId, wk, roster, scores, oppIsDouble, byeMode, oppPick)

    points_for += myScore
    if (myScore > oppScore) wins++
    else losses++
  }

  return { wins, losses, points_for: Math.round(points_for) }
}

/**
 * Get playoff seeds: top 4 teams by wins, tiebreaker = points for.
 */
export function getPlayoffSeeds(
  teams: FantasyTeam[],
  roster: RosterSlot[],
  scores: PlayerScore[],
  schedule: WeekSchedule[],
  matchups: Matchup[],
  byeMode: ByeMode,
  gamePicks: Array<{ team_id: number; week: number; game_choice: GameChoice }>
): TeamRecord[] {
  const records: TeamRecord[] = teams.map(team => {
    const rec = calcTeamRecord(team.id, 10, roster, scores, schedule, matchups, byeMode, gamePicks)
    return { team, ...rec }
  })

  return records
    .sort((a, b) => b.wins - a.wins || b.points_for - a.points_for)
    .slice(0, 4)
}
