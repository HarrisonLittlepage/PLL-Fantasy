'use client'
// app/components/FreeAgentsTab.tsx

import { useState } from 'react'
import type { FantasyTeam, Player, PlayerScore, RosterSlot, LeagueSettings, WeekSchedule, Matchup, GamePick } from '../types'

interface Props {
  myTeamId: number
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

export default function FreeAgentsTab({ myTeamId, players, scores, rosters, settings, onRefresh }: Props) {
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const week = settings.current_week
  const ownedIds = new Set(rosters.map(r => r.player_id).filter(Boolean))
  const myRoster = rosters.filter(r => r.team_id === myTeamId)

  const freeAgents = players.filter(p =>
    !ownedIds.has(p.id) &&
    (filter === 'ALL' || p.position === filter) &&
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => b.avg_pts - a.avg_pts)

  async function addPlayer(player: Player) {
    const benchSlot = [10, 11, 12, 13].find(i => !myRoster.find(r => r.slot_index === i)?.player_id)
    if (benchSlot === undefined) {
      setMsg('Bench is full — drop a player from My Team first')
      setTimeout(() => setMsg(''), 4000)
      return
    }
    setSaving(true)
    const res = await fetch('/api/roster/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_index: benchSlot, player_id: player.id }),
    })
    if (res.ok) {
      onRefresh()
      setMsg(player.name + ' added to bench')
      setTimeout(() => setMsg(''), 3000)
    } else {
      const d = await res.json()
      setMsg(d.error ?? 'Error adding player')
    }
    setSaving(false)
  }

  const weekPts = (p: Player) => scores.find(s => s.player_id === p.id && s.week === week && s.game === 'A')?.points ?? '—'

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 140 }}
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-bar" style={{ margin: 0 }}>
          {['ALL', 'A', 'M', 'D', 'SSDM', 'FO', 'G'].map(f => (
            <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      {msg && (
        <div style={{ padding: '7px 12px', background: '#1a3a2a', border: '1px solid var(--green)', borderRadius: 5, fontSize: 12, color: 'var(--green)', marginBottom: 10, fontFamily: 'sans-serif' }}>
          {msg}
        </div>
      )}

      <div className="section-title">{freeAgents.length} available</div>

      {freeAgents.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 5, transition: 'background .1s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-light)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span className={`pos pos-${p.position}`}>{p.position}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontFamily: 'sans-serif' }}>{p.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{p.pll_team}</div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 60, fontFamily: 'sans-serif', fontSize: 12 }}>
            <div style={{ color: 'var(--gold)' }}>{weekPts(p)} pts</div>
            <div style={{ color: 'var(--muted)', fontSize: 10 }}>avg {p.avg_pts}</div>
          </div>
          <button className="btn btn-sm btn-success" disabled={saving} onClick={() => addPlayer(p)}>Add</button>
        </div>
      ))}

      {freeAgents.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'sans-serif', padding: '20px 0', textAlign: 'center' }}>
          No free agents match your filter.
        </div>
      )}
    </div>
  )
}
