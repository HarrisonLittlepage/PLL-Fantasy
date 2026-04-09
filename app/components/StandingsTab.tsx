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
      <div className="section-title">Regular Season Standings — Week {week} of 10</div>

      <div className="standings-row" style={{ color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--navy-border)', paddingBottom: 6, marginBottom: 4 }}>
        <div>#</div>
        <div>Team</div>
        <div style={{ textAlign: 'center' }}>W</div>
        <div style={{ textAlign: 'center' }}>L</div>
        <div style={{ textAlign: 'center' }}>PF</div>
        <div style={{ textAlign: 'right' }}>Status</div>
      </div>

      {rows.map((row, i) => (
        <div key={row.team.id}>
          {i === 4 && <div className="playoff-cut" />}
          <div className="standings-row" style={row.team.id === teams[0]?.id ? {} : {}}>
            <div style={{ color: i < 4 ? 'var(--gold)' : 'var(--muted)', fontSize: 11 }}>{i + 1}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 15 }}>{row.team.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontFamily: 'sans-serif' }}>{row.team.name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{row.team.owner_name}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 600, fontFamily: 'sans-serif' }}>{row.wins}</div>
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontFamily: 'sans-serif' }}>{row.losses}</div>
            <div style={{ textAlign: 'center', color: 'var(--gold)', fontFamily: 'sans-serif' }}>{row.points_for}</div>
            <div style={{ textAlign: 'right' }}>
              {i < 4
                ? <span className="pill pill-playoff">Playoff</span>
                : <span className="pill pill-loss">Out</span>
              }
            </div>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', padding: '8px 12px', background: 'var(--navy-light)', borderRadius: 6 }}>
        Top 4 teams advance to playoffs. Tiebreaker: Points For. Bye weeks are excluded from W/L record.
      </div>
    </div>
  )
}
