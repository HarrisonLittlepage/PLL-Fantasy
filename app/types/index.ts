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
  waiver_pick_trades: Array<{ from_team_id: number; to_team_id: number }>
}

export interface Transaction {
  id: number
  team_id: number
  type: 'add' | 'drop'
  player_id: number
  transaction_group: string
  created_at: string
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
  matchup_type?: 'regular' | 'semifinal' | 'toilet_bowl' | 'championship' | 'third_place' | 'toilet_bowl_2'
  seed_label?: string | null
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

export interface Trade {
  id: number
  proposing_team_id: number
  receiving_team_id: number
  status: 'pending' | 'accepted' | 'declined' | 'vetoed' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  trade_assets: TradeAsset[]
}

export interface TradeAsset {
  id: number
  trade_id: number
  team_id: number
  player_id: number
}

export interface TeamRecord {
  team: FantasyTeam
  wins: number
  losses: number
  points_for: number
}

const BASE_SLOT_LABELS = [
  'Faceoff', 'Attack', 'Attack', 'Midfield', 'Midfield',
  'Defense', 'Defense', 'Goalie', 'Flex', 'Flex'
]
const BASE_SLOT_POSITIONS = [
  'FO', 'A', 'A', 'M', 'M', 'D', 'D', 'G', 'FLEX', 'FLEX'
]

export function getSlotLabel(index: number): string {
  if (index < 10) return BASE_SLOT_LABELS[index]
  return 'Bench'
}

export function getSlotPosition(index: number): string {
  if (index < 10) return BASE_SLOT_POSITIONS[index]
  return 'BN'
}

// Keep arrays for backward compatibility
export const SLOT_LABELS = BASE_SLOT_LABELS
export const SLOT_POSITIONS = BASE_SLOT_POSITIONS

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
