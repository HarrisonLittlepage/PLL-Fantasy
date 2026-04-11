'use client'
// app/components/StandingsTab.tsx

import type { FantasyTeam, Player, PlayerScore, RosterSlot, LeagueSettings, WeekSchedule, Matchup, GamePick } from '../types'
import { calcTeamRecord } from '../lib/scoring'

interface Props {
  teams: FantasyTeam[]
  players: Player[]
  scores: PlayerScore[]
  rosters: RosterSlot[]
  settings: LeagueSettings
  schedule: WeekSchedule[]
  matchups: Matchup[]
  gamePicks: GamePick[]
  onRefresh: () => void
}

export default function StandingsTab({ teams, scores, rosters, settings, schedule, matchups, gamePicks }: Props) {
  const { current_week: week, bye_scoring_mode: byeMode } = settings

  const rows = teams.map(team => {
    const rec = calcTeamRecord(team.id, week - 1, rosters, scores, schedule, matchups, byeMode, gamePicks)
    return { team, ...rec }
  }).sort((a, b) => b.wins - a.wins || b.points_for - a.points_for)

  return (
    <div>
      <div className="section-title">Standings</div>

      <div style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) 36px 36px 50px', alignItems: 'center', gap: 6, padding: '7px 8px', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--navy-border)', paddingBottom: 6, marginBottom: 4 }}>
        <div>#</div>
        <div>Team</div>
        <div style={{ textAlign: 'center' }}>W</div>
        <div style={{ textAlign: 'center' }}>L</div>
        <div style={{ textAlign: 'center' }}>PF</div>
      </div>

      {rows.map((row, i) => (
        <div key={row.team.id}>
          {i === 4 && <div className="playoff-cut" />}
          <div style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) 36px 36px 50px', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 5, fontFamily: 'sans-serif', fontSize: 12 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-light)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ color: i < 4 ? 'var(--gold)' : 'var(--muted)', fontSize: 11 }}>{i + 1}</div>
            <div>
              <div style={{ fontSize: 13 }}>{row.team.name}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{row.team.owner_name}</div>
            </div>
            <div style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 600 }}>{row.wins}</div>
            <div style={{ textAlign: 'center', color: 'var(--muted)' }}>{row.losses}</div>
            <div style={{ textAlign: 'center', color: 'var(--gold)' }}>{row.points_for}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
