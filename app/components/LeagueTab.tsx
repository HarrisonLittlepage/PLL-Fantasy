'use client'
// app/components/LeagueTab.tsx

import { useState } from 'react'
import type { FantasyTeam, Player, PlayerScore, RosterSlot, RosterSnapshot, LeagueSettings, WeekSchedule, Matchup, GamePick, PllDoubleHeader } from '../types'
import { SLOT_LABELS } from '../types'
import { getTeamWeekScore, calcTeamRecord } from '../lib/scoring'

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
  const [viewing, setViewing] = useState<number | null>(null)
  const week = settings.current_week

  return (
    <div>
      <div className="section-title">All Teams</div>
      <div className="grid2">
        {teams.map(team => {
          const rec = calcTeamRecord(team.id, week - 1, rosters, scores, players, schedule, matchups, pllDoubleHeaders, week, snapshots)
          const score = getTeamWeekScore(team.id, week, rosters, scores, players, pllDoubleHeaders, week, snapshots)
          const teamRoster = rosters.filter(r => r.team_id === team.id).sort((a, b) => a.slot_index - b.slot_index)
          const isExpanded = viewing === team.id

          return (
            <div key={team.id} className="card-sm"
              style={{ cursor: 'pointer', border: '1px solid var(--navy-border)' }}
              onClick={() => setViewing(isExpanded ? null : team.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isExpanded ? 10 : 0 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif' }}>{team.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{team.owner_name} · {rec.wins}-{rec.losses}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)', fontFamily: 'sans-serif' }}>{score}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>Wk {week}</div>
                </div>
              </div>
              {isExpanded && teamRoster.map(slot => {
                const p = slot.player_id ? players.find(pl => pl.id === slot.player_id) : null
                const isDouble = p ? pllDoubleHeaders.some(dh => dh.week === week && dh.pll_team === p.pll_team) : false
                const gameA = p ? Number(scores.find(s => s.player_id === p.id && s.week === week && s.game === 'A')?.points ?? 0) : null
                const gameB = p ? scores.find(s => s.player_id === p.id && s.week === week && s.game === 'B')?.points : undefined
                const wkPts = p ? (isDouble && gameB !== undefined ? Math.round(((gameA! + Number(gameB)) / 2) * 100) / 100 : gameA) : null
                return (
                  <div key={slot.slot_index} style={{ display: 'flex', gap: 6, padding: '3px 0', fontSize: 11, fontFamily: 'sans-serif', alignItems: 'center', borderBottom: '1px solid var(--navy-border)' }}>
                    <span style={{ minWidth: 52, color: 'var(--muted)', fontSize: 9 }}>{SLOT_LABELS[slot.slot_index]}</span>
                    {p ? (
                      <>
                        <span className={`pos pos-${p.position}`}>{p.position}</span>
                        <span style={{ flex: 1 }}>{p.name}</span>
                        <span style={{ color: 'var(--gold)' }}>{wkPts}</span>
                      </>
                    ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
