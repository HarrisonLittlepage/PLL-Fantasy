'use client'
// app/components/MyTeamTab.tsx

import { useState } from 'react'
import type { FantasyTeam, Player, PlayerScore, RosterSlot, LeagueSettings, WeekSchedule, Matchup, GamePick } from '../types'
import { SLOT_LABELS, SLOT_POSITIONS, ELIGIBLE_POSITIONS } from '../types'
import { getTeamWeekScore, calcTeamRecord } from '../lib/scoring'

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

export default function MyTeamTab({ myTeamId, teams, players, scores, rosters, settings, schedule, gamePicks, onRefresh }: Props) {
  const [swapSlot, setSwapSlot] = useState<number | null>(null)
  const [filter, setFilter] = useState('ALL')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  const week = settings.current_week
  const byeMode = settings.bye_scoring_mode
  const wkData = schedule.find(s => s.week === week)
  const isDoubleTeam = wkData?.double_team_id === myTeamId
  const isByeTeam = wkData?.bye_team_id === myTeamId
  const myTeam = teams.find(t => t.id === myTeamId)

  const myRoster = rosters.filter(r => r.team_id === myTeamId).sort((a, b) => a.slot_index - b.slot_index)
  const playerAtSlot = (idx: number) => {
    const slot = myRoster.find(r => r.slot_index === idx)
    return slot?.player_id ? players.find(p => p.id === slot.player_id) ?? null : null
  }

  const ownedIds = new Set(rosters.map(r => r.player_id).filter(Boolean))
  const freeAgents = players.filter(p => !ownedIds.has(p.id))

  const myPick = gamePicks.find(gp => gp.team_id === myTeamId && gp.week === week)?.game_choice ?? 'A'
  const weekScore = getTeamWeekScore(myTeamId, week, rosters, scores, !!isDoubleTeam, byeMode, myPick)
  const record = calcTeamRecord(myTeamId, week - 1, rosters, scores, schedule, [], byeMode, gamePicks)

  async function updateSlot(slotIndex: number, playerId: number | null) {
    setSaving(true)
    const res = await fetch('/api/roster/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_index: slotIndex, player_id: playerId }),
    })
    if (res.ok) { onRefresh(); setSwapSlot(null); setMsg('') }
    else { const d = await res.json(); setMsg(d.error ?? 'Error saving') }
    setSaving(false)
  }

  async function saveGamePick(choice: 'A' | 'B') {
    await fetch('/api/roster/game-pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week, game_choice: choice }),
    })
    onRefresh()
  }

  async function addToRoster(player: Player) {
    const benchSlot = Array.from({ length: 14 }, (_, i) => i)
      .filter(i => i >= 10)
      .find(i => !myRoster.find(r => r.slot_index === i)?.player_id)
    if (benchSlot === undefined) { setMsg('Bench is full — swap a player first'); return }
    await updateSlot(benchSlot, player.id)
    setMsg(player.name + ' added to bench')
    setTimeout(() => setMsg(''), 3000)
  }

  async function saveTeamName() {
    if (!nameInput.trim()) return
    setNameSaving(true)
    const res = await fetch('/api/roster/update-team-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: myTeamId, name: nameInput.trim() }),
    })
    if (res.ok) {
      onRefresh()
      setEditingName(false)
    } else {
      const d = await res.json()
      setMsg(d.error ?? 'Error saving name')
    }
    setNameSaving(false)
  }

  const available = (swapSlot !== null
    ? freeAgents.filter(p => {
        const slotPos = SLOT_POSITIONS[swapSlot]
        return ELIGIBLE_POSITIONS[slotPos]?.includes(p.position) || slotPos === 'BN'
      })
    : freeAgents
  ).filter(p => filter === 'ALL' || p.position === filter)

  const playerScore = (p: Player) => {
    const gameA = scores.find(s => s.player_id === p.id && s.week === week && s.game === 'A')?.points ?? 0
    return gameA
  }

  return (
    <div>
      {/* Team name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        {editingName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
            <input
              className="input"
              style={{ maxWidth: 260 }}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTeamName(); if (e.key === 'Escape') setEditingName(false) }}
              autoFocus
            />
            <button className="btn btn-sm btn-gold" onClick={saveTeamName} disabled={nameSaving}>
              {nameSaving ? 'Saving...' : 'Save'}
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => setEditingName(false)}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)', fontFamily: 'sans-serif' }}>{myTeam?.name}</div>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => { setNameInput(myTeam?.name ?? ''); setEditingName(true) }}
            >
              Rename
            </button>
          </div>
        )}
      </div>

      <div className="grid4" style={{ marginBottom: 18 }}>
        <div className="stat-chip"><div className="stat-val">{weekScore}</div><div className="stat-lbl">Wk {week} Score</div></div>
        <div className="stat-chip"><div className="stat-val">{record.wins}-{record.losses}</div><div className="stat-lbl">Record</div></div>
        <div className="stat-chip"><div className="stat-val">{record.points_for}</div><div className="stat-lbl">Points For</div></div>
        <div className="stat-chip"><div className="stat-val">{myRoster.filter(r => r.player_id && r.slot_index < 10).length}/10</div><div className="stat-lbl">Starters</div></div>
      </div>

      {isByeTeam && (
        <div style={{ padding: '8px 12px', background: '#1a1a20', border: '1px solid var(--navy-border)', borderRadius: 6, fontSize: 12, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 12 }}>
          Your team is on bye this week — no matchup.
        </div>
      )}

      {isDoubleTeam && byeMode === 'pick' && (
        <div style={{ padding: '12px 14px', background: '#1a0f2a', border: '1px solid #4a2060', borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#b06ade', fontFamily: 'sans-serif', fontWeight: 600, marginBottom: 8 }}>
            Double-header week — pick which game counts
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn ${myPick === 'A' ? 'btn-gold' : 'btn-outline'}`} onClick={() => saveGamePick('A')}>Game A</button>
            <button className={`btn ${myPick === 'B' ? 'btn-gold' : 'btn-outline'}`} onClick={() => saveGamePick('B')}>Game B</button>
          </div>
        </div>
      )}

      {isDoubleTeam && byeMode === 'avg' && (
        <div style={{ padding: '8px 12px', background: '#1a0f2a', border: '1px solid #4a2060', borderRadius: 6, fontSize: 12, color: '#b06ade', fontFamily: 'sans-serif', marginBottom: 12 }}>
          Double-header week — your score is averaged across both games.
        </div>
      )}

      {msg && (
        <div style={{ padding: '7px 12px', background: '#3a1a1a', border: '1px solid var(--red)', borderRadius: 5, fontSize: 12, color: '#e06060', fontFamily: 'sans-serif', marginBottom: 10 }}>
          {msg}
        </div>
      )}

      <div className="grid2">
        <div>
          <div className="section-title">Roster — click Swap to change a player</div>
          {Array.from({ length: 14 }, (_, i) => {
            const p = playerAtSlot(i)
            const isSel = swapSlot === i
            const wkPts = p ? playerScore(p) : null
            return (
              <div key={i} className="roster-slot" style={isSel ? { border: '1px solid var(--gold)' } : {}}>
                <div>
                  <div className="slot-label">{SLOT_LABELS[i]}</div>
                  {p && <span className={`pos pos-${p.position}`}>{p.position}</span>}
                </div>
                <div>
                  {p ? (
                    <div>
                      <div style={{ fontSize: 12, fontFamily: 'sans-serif' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{p.pll_team}</div>
                    </div>
                  ) : <div className="slot-empty">Empty</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                  {wkPts != null && <span style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'sans-serif' }}>{wkPts}</span>}
                  <button
                    className={`btn btn-sm ${isSel ? 'btn-danger' : 'btn-outline'}`}
                    onClick={() => setSwapSlot(isSel ? null : i)}
                    disabled={saving}
                  >
                    {isSel ? '✕' : 'Swap'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div>
          <div className="section-title">{swapSlot !== null ? `Swap — ${SLOT_LABELS[swapSlot]}` : 'Free Agents'}</div>
          <div className="filter-bar">
            {['ALL', 'A', 'M', 'D', 'SSDM', 'FO', 'G'].map(f => (
              <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {available.sort((a, b) => b.avg_pts - a.avg_pts).map(p => (
              <div key={p.id} className="player-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 5 }}>
                <span className={`pos pos-${p.position}`}>{p.position}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontFamily: 'sans-serif' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{p.pll_team}</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--gold)', fontFamily: 'sans-serif', minWidth: 32, textAlign: 'right' }}>{playerScore(p)}</span>
                <button
                  className="btn btn-sm btn-success"
                  disabled={saving}
                  onClick={() => swapSlot !== null ? updateSlot(swapSlot, p.id) : addToRoster(p)}
                >
                  {swapSlot !== null ? 'Move' : 'Add'}
                </button>
              </div>
            ))}
            {available.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'sans-serif', padding: '12px 8px' }}>No free agents at this position.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
