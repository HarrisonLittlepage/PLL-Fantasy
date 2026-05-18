// app/types/index.ts

export type Position = 'A' | 'M' | 'D' | 'SSDM' | 'LSM' | 'FO' | 'G'
export type ByeMode = 'avg' | 'pick'
export type GameChoice = 'A' | 'B'

export interface Profile {
  id: string
  email: string
  display_name: string
  is_commissioner: boolean
  team_id: number | null
}

export interface FantasyTeam {
  id: number
  name: string
  owner_name: string
  icon: string
}

export interface Player {
  id: number
  name: string
  position: Position
  pll_team: string
  avg_pts: number
}

export interface PlayerScore {
  player_id: number
  week: number
  game: 'A' | 'B'
  points: number
}

export interface RosterSlot {
  team_id: number
  slot_index: number
  player_id: number | null
}

export interface RosterSnapshot {
  team_id: number
  week: number
  slot_index: number
  player_id: number | null
}

export interface LeagueSettings {
  current_week: number
  bye_scoring_mode: ByeMode
  season_year: number
  locked_pll_teams: string[]
  waiver_state: string | null
  waiver_order: number[]
  waiver_current_idx: number
}

export interface WeekSchedule {
  week: number
  week_type: 'regular' | 'playoffs'
  playoff_label: string | null
  bye_team_id: number | null
  double_team_id: number | null
}

export interface Matchup {
  week: number
  home_team_id: number
  away_team_id: number
  is_playoff: boolean
}

export interface GamePick {
  team_id: number
  week: number
  game_choice: GameChoice
}

export interface PllDoubleHeader {
  week: number
  pll_team: string
}

export interface TeamRecord {
  team: FantasyTeam
  wins: number
  losses: number
  points_for: number
}

export const SLOT_LABELS = [
  'Faceoff', 'Attack', 'Attack', 'Midfield', 'Midfield',
  'Defense', 'Defense', 'Goalie',
  'Flex', 'Flex', 'Bench', 'Bench', 'Bench', 'Bench'
]

export const SLOT_POSITIONS = [
  'A', 'A', 'M', 'M', 'D', 'D', 'FO', 'G', 'FLEX', 'FLEX', 'BN', 'BN', 'BN', 'BN'
]

export const ELIGIBLE_POSITIONS: Record<string, Position[]> = {
  A:    ['A'],
  M:    ['M', 'SSDM'],
  D:    ['D', 'SSDM', 'LSM'],
  FO:   ['FO'],
  G:    ['G'],
  FLEX: ['A', 'M', 'D', 'SSDM', 'LSM', 'FO'],
  BN:   ['A', 'M', 'D', 'SSDM', 'LSM', 'FO', 'G'],
}

export const PLL_TEAMS = ['Archers', 'Atlas', 'Cannons', 'Chaos', 'Outlaws', 'Redwoods', 'Waterdogs', 'Whipsnakes']


export function shortName(name: string): string {
  if (!name) return name
  const parts = name.trim().split(' ')
  if (parts.length < 2) return name
  const last = parts[parts.length - 1]
  if (last === 'G' || last === 'FO') return name
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}
