'use client'
// app/components/FreeAgentsTab.tsx

import { apiFetch } from '../lib/api-fetch'
import { useState } from 'react'
import type { FantasyTeam, Player, PlayerScore, RosterSlot, RosterSnapshot, LeagueSettings, WeekSchedule, Matchup, GamePick, PllDoubleHeader } from '../types'

interface Props {
  myTeamId: number
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

export default function FreeAgentsTab({ myTeamId, players, scores, rosters, settings, onRefresh }: Props) {
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [saving, setSaving] = useState(false)

  const week = settings.current_week
  const lockedTeams: string[] = settings.locked_pll_teams ?? []
  const waiverOpen = settings.waiver_state === 'open'
  const allOwnedIds = new Set(rosters.map(r => r.player_id).filter(Boolean))
  const myRoster = rosters.filter(r => r.team_id === myTeamId)
  const myRosterCount = myRoster.filter(r => r.player_id !== null).length
  const isFull = myRosterCount >= 14

  const freeAgents = players.filter(p =>
    !allOwnedIds.has(p.id) &&
    (filter === 'ALL' || p.position === filter) &&
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => b.avg_pts - a.avg_pts)

  function showMsg(text: string, type: 'success' | 'error') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  async function addPlayer(player: Player) {
    if (waiverOpen) {
      showMsg('Waivers are active — use the Waivers tab to add players', 'error')
      return
    }
    if (isFull) {
      showMsg('Roster is full (14/14) — drop a player before adding', 'error')
      return
    }
    if (lockedTeams.includes(player.pll_team)) {
      showMsg(`${player.pll_team} players are locked during live games`, 'error')
      return
    }

    const benchSlot = [10, 11, 12, 13].find(i => {
      const slot = myRoster.find(r => r.slot_index === i)
      return !slot || slot.player_id === null
    })

    if (benchSlot === undefined) {
      showMsg('Bench is full — move a bench player to a starter slot first', 'error')
      return
    }

    setSaving(true)
    const res = await apiFetch('/api/roster/update-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: [{ slot_index: benchSlot, player_id: player.id }] }),
    })

    if (res.ok) {
      await onRefresh()
      showMsg(`${player.name} added to bench`, 'success')
    } else {
      const d = await res.json()
      showMsg(d.error ?? 'Error adding player', 'error')
    }
    setSaving(false)
  }

  const weekPts = (p: Player) =>
    scores.find(s => s.player_id === p.id && s.week === week && s.game === 'A')?.points ?? null

  return (
    <div>
      {/* Roster status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '8px 12px', background: 'var(--navy-light)', borderRadius: 7, border: '1px solid var(--navy-border)' }}>
        <div style={{ fontSize: 13, fontFamily: 'sans-serif' }}>
          Roster: <strong style={{ color: isFull ? '#e06060' : 'var(--green)' }}>{myRosterCount}/14</strong>
        </div>
        {isFull ? (
          <div style={{ fontSize: 11, color: '#e06060', fontFamily: 'sans-serif' }}>Full — drop a player to add someone new</div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>Players are added to your bench. Move them to starter slots from My Team.</div>
        )}
      </div>

      {/* Waiver notice */}
      {waiverOpen && (
        <div style={{ padding: '10px 14px', background: '#1a1a08', border: '1px solid var(--gold-dark)', borderRadius: 6, fontSize: 12, color: 'var(--gold)', fontFamily: 'sans-serif', marginBottom: 12 }}>
          Waiver wire is active — use the Waivers tab to add players.
        </div>
      )}

      {/* Lock notice */}
      {lockedTeams.length > 0 && (
        <div style={{ padding: '7px 12px', background: '#1a0808', border: '1px solid var(--red)', borderRadius: 6, fontSize: 12, color: '#e06060', fontFamily: 'sans-serif', marginBottom: 12 }}>
          🔒 Locked teams (live games): {lockedTeams.join(', ')}
        </div>
      )}

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 140 }}
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-bar" style={{ margin: 0 }}>
          {['ALL', 'A', 'M', 'D', 'SSDM', 'LSM', 'FO', 'G'].map(f => (
            <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {msg && (
        <div style={{ padding: '7px 12px', borderRadius: 5, fontSize: 12, fontFamily: 'sans-serif', marginBottom: 10, background: msg.type === 'error' ? '#3a1a1a' : '#1a3a2a', border: `1px solid ${msg.type === 'error' ? 'var(--red)' : 'var(--green)'}`, color: msg.type === 'error' ? '#e06060' : 'var(--green)' }}>
          {msg.text}
        </div>
      )}

      <div className="section-title">{freeAgents.length} available</div>

      {freeAgents.map(p => {
        const pts = weekPts(p)
        const isLocked = lockedTeams.includes(p.pll_team)
        return (
          <div
            key={p.id}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 5, transition: 'background .1s', opacity: isLocked ? 0.6 : 1 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-light)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span className={`pos pos-${p.position}`}>{p.position}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontFamily: 'sans-serif' }}>
                {p.name}
                {isLocked && <span style={{ marginLeft: 5, fontSize: 10 }}>🔒</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{p.pll_team}</div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 54, fontFamily: 'sans-serif', fontSize: 11 }}>
              {pts != null && <div style={{ color: 'var(--gold)' }}>{pts} pts</div>}
              <div style={{ color: 'var(--muted)', fontSize: 10 }}>avg {p.avg_pts}</div>
            </div>
            <button
              className="btn btn-sm btn-success"
              disabled={saving || isFull || isLocked || waiverOpen}
              onClick={() => addPlayer(p)}
              style={isFull || isLocked || waiverOpen ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              {isLocked ? '🔒' : waiverOpen ? '—' : 'Add'}
            </button>
          </div>
        )
      })}

      {freeAgents.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'sans-serif', padding: '20px 0', textAlign: 'center' }}>
          No free agents match your filter.
        </div>
      )}
    </div>
  )
}
