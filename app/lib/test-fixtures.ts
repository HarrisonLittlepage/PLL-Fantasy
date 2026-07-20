// Test fixture factories for scoring/logic unit tests.
// Small overridable builders so tests read as data, not boilerplate.

import type {
  Player,
  PlayerScore,
  RosterSlot,
  FantasyTeam,
  WeekSchedule,
  Matchup,
  PllDoubleHeader,
} from '../types'
import type { RosterSnapshot } from './scoring'

export function makePlayer(over: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: 'Test Player',
    position: 'A',
    pll_team: 'Atlas',
    avg_pts: 0,
    ...over,
  }
}

export function makeScore(over: Partial<PlayerScore> = {}): PlayerScore {
  return {
    player_id: 1,
    week: 1,
    game: 'A',
    points: 0,
    ...over,
  }
}

export function makeRosterSlot(over: Partial<RosterSlot> = {}): RosterSlot {
  return {
    team_id: 1,
    slot_index: 0,
    player_id: 1,
    ...over,
  }
}

export function makeSnapshot(over: Partial<RosterSnapshot> = {}): RosterSnapshot {
  return {
    team_id: 1,
    week: 1,
    slot_index: 0,
    player_id: 1,
    ...over,
  }
}

export function makeTeam(over: Partial<FantasyTeam> = {}): FantasyTeam {
  return {
    id: 1,
    name: 'Team 1',
    owner_name: 'Owner 1',
    icon: '⚡',
    ...over,
  }
}

export function makeWeek(over: Partial<WeekSchedule> = {}): WeekSchedule {
  return {
    week: 1,
    week_type: 'regular',
    playoff_label: null,
    bye_team_id: null,
    double_team_id: null,
    ...over,
  }
}

export function makeMatchup(over: Partial<Matchup> = {}): Matchup {
  return {
    week: 1,
    home_team_id: 1,
    away_team_id: 2,
    is_playoff: false,
    ...over,
  }
}

export function makeDoubleHeader(over: Partial<PllDoubleHeader> = {}): PllDoubleHeader {
  return {
    week: 1,
    pll_team: 'Atlas',
    ...over,
  }
}

/**
 * Build a full 10-slot starting lineup for a team, one player per slot.
 * Returns the roster slots plus matching players.
 */
export function makeLineup(
  teamId: number,
  playerIdStart: number,
): { roster: RosterSlot[]; players: Player[] } {
  const roster: RosterSlot[] = []
  const players: Player[] = []
  for (let i = 0; i < 10; i++) {
    const pid = playerIdStart + i
    roster.push(makeRosterSlot({ team_id: teamId, slot_index: i, player_id: pid }))
    players.push(makePlayer({ id: pid, name: `P${pid}` }))
  }
  return { roster, players }
}
