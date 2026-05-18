'use client'
// app/components/LeagueTab.tsx

import { useState } from 'react'
import type { FantasyTeam, Player, PlayerScore, RosterSlot, RosterSnapshot, LeagueSettings, WeekSchedule, Matchup, GamePick, PllDoubleHeader } from '../types'
import { SLOT_LABELS } from '../types'
import { getTeamWeekScore, calcTeamRecord, getPlayerWeekScore } from '../lib/scoring'

interface Props {
  teams: FantasyTeam[]
  players: Player[]
  scores: PlayerScore[]
  rosters: RosterSlot[]
  snapshots: RosterSnapshot[]
  settings: LeagueSettings
  schedule: WeekSchedule[]
  matchups: Matchup[]
  gamePicks: GamePick[]
  pllDoubleHeaders: PllDoubleHeader[]
  onRefresh: () => void
}

export default function LeagueTab({ teams, players, scores, rosters, snapshots, settings, schedule, matchups, pllDoubleHeaders }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const week = settings.current_week

  function toggle(teamId: number) {
    setExpanded(prev => prev === teamId ? null : teamId)
  }

  return (
    <div>
      <div className="section-title">Rosters</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {teams.map(team => {
          const rec = calcTeamRecord(team.id, week - 1, rosters, scores, players, schedule, matchups, pllDoubleHeaders, week, snapshots)
          const score = getTeamWeekScore(team.id, week, rosters, scores, players, pllDoubleHeaders, week, snapshots)
          const teamRoster = rosters.filter(r => r.team_id === team.id).sort((a, b) => a.slot_index - b.slot_index)
          const isExpanded = expanded === team.id

          return (
            <div key={team.id} style={{ border: '1px solid var(--navy-border)', borderRadius: 8, overflow: 'hidden' }}>
              {/* Header row */}
              <div
                style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', cursor: 'pointer', background: isExpanded ? 'var(--navy-light)' : 'transparent' }}
                onClick={() => toggle(team.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'sans-serif' }}>{team.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginTop: 2 }}>
                    {team.owner_name} · {rec.wins}-{rec.losses} · {rec.points_for} PF
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginRight: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)', fontFamily: 'sans-serif' }}>{score}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>Wk {week}</div>
                </div>
                <div style={{ fontSize: 16, color: 'var(--muted)', userSelect: 'none' }}>
                  {isExpanded ? '▲' : '▼'}
                </div>
              </div>

              {/* Expanded roster */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--navy-border)' }}>
                  {/* Starters */}
                  <div style={{ padding: '6px 14px 2px', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'sans-serif' }}>
                    Starters
                  </div>
                  {teamRoster.filter(s => s.slot_index < 10).map(slot => {
                    const p = slot.player_id ? players.find(pl => pl.id === slot.player_id) ?? null : null
                    const pts = p ? getPlayerWeekScore(p.id, week, scores, players, pllDoubleHeaders) : null
                    return (
                      <div key={slot.slot_index} style={{
                        display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) 36px',
                        gap: 6, padding: '6px 14px', fontSize: 12, fontFamily: 'sans-serif',
                        alignItems: 'center', borderBottom: '1px solid var(--navy-border)',
                      }}>
                        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                          {SLOT_LABELS[slot.slot_index]}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p && <span className={`pos pos-${p.position}`}>{p.position}</span>}
                          <span style={{ color: p ? 'var(--text)' : 'var(--muted)' }}>{p?.name ?? '—'}</span>
                        </div>
                        <div style={{ textAlign: 'right', color: 'var(--gold)', fontWeight: 600, fontSize: 12 }}>
                          {pts != null && p ? pts : ''}
                        </div>
                      </div>
                    )
                  })}
                  {/* Bench */}
                  <div style={{ padding: '6px 14px 2px', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'sans-serif', marginTop: 4 }}>
                    Bench
                  </div>
                  {teamRoster.filter(s => s.slot_index >= 10).map(slot => {
                    const p = slot.player_id ? players.find(pl => pl.id === slot.player_id) ?? null : null
                    return (
                      <div key={slot.slot_index} style={{
                        display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) 36px',
                        gap: 6, padding: '5px 14px', fontSize: 11, fontFamily: 'sans-serif',
                        alignItems: 'center', borderBottom: '1px solid var(--navy-border)',
                        opacity: 0.7,
                      }}>
                        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                          {SLOT_LABELS[slot.slot_index]}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p && <span className={`pos pos-${p.position}`}>{p.position}</span>}
                          <span style={{ color: p ? 'var(--text)' : 'var(--muted)' }}>{p?.name ?? '—'}</span>
                        </div>
                        <div />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
