'use client'
// app/components/MyTeamTab.tsx

import { apiFetch } from '../lib/api-fetch'
import { useState } from 'react'
import type { Player, PlayerScore, RosterSlot, LeagueSettings, WeekSchedule, GamePick, FantasyTeam, PllDoubleHeader } from '../types'
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
  matchups: any[]
  gamePicks: GamePick[]
  pllDoubleHeaders: PllDoubleHeader[]
  onRefresh: () => void
}

function canFitInSlot(player: Player, slotIndex: number): boolean {
  const slotPos = SLOT_POSITIONS[slotIndex]
  return !!(ELIGIBLE_POSITIONS[slotPos]?.includes(player.position))
}

export default function MyTeamTab({ myTeamId, teams, players, scores, rosters, settings, schedule, gamePicks, pllDoubleHeaders, onRefresh }: Props) {
  const [dropMode, setDropMode] = useState(false)
  const [dropping, setDropping] = useState<Set<number>>(new Set())
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [pending, setPending] = useState<Record<number, number | null>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  const week = settings.current_week
  const myTeam = teams.find(t => t.id === myTeamId)
  const savedRoster = rosters.filter(r => r.team_id === myTeamId).sort((a, b) => a.slot_index - b.slot_index)
  const weekScore = getTeamWeekScore(myTeamId, week, rosters, scores, players, pllDoubleHeaders)
  const record = calcTeamRecord(myTeamId, week - 1, rosters, scores, players, schedule, [], pllDoubleHeaders)

  function getPlayerAtSlot(i: number): Player | null {
    const playerId = i in pending
      ? pending[i]
      : savedRoster.find(r => r.slot_index === i)?.player_id ?? null
    return playerId ? players.find(p => p.id === playerId) ?? null : null
  }

  function showMsg(text: string, type: 'error' | 'success') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  function handleSlotTap(slotIndex: number) {
    if (dropMode) return
    if (selectedSlot === slotIndex) { setSelectedSlot(null); return }
    if (selectedSlot === null) {
      if (getPlayerAtSlot(slotIndex)) setSelectedSlot(slotIndex)
      return
    }
    const fromPlayer = getPlayerAtSlot(selectedSlot)!
    const toPlayer = getPlayerAtSlot(slotIndex)
    if (!canFitInSlot(fromPlayer, slotIndex)) {
      showMsg(`${fromPlayer.name} (${fromPlayer.position}) can't play ${SLOT_LABELS[slotIndex]}`, 'error')
      setSelectedSlot(null); return
    }
    if (toPlayer && !canFitInSlot(toPlayer, selectedSlot)) {
      showMsg(`${toPlayer.name} (${toPlayer.position}) can't play ${SLOT_LABELS[selectedSlot]}`, 'error')
      setSelectedSlot(null); return
    }
    setPending(prev => ({ ...prev, [selectedSlot]: toPlayer?.id ?? null, [slotIndex]: fromPlayer.id }))
    setSelectedSlot(null)
  }

  async function saveSwaps() {
    if (Object.keys(pending).length === 0) return
    setSaving(true)
    const slots = Object.entries(pending).map(([slotIndex, player_id]) => ({ slot_index: parseInt(slotIndex), player_id }))
    const res = await apiFetch('/api/roster/update-batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots }),
    })
    if (res.ok) { setPending({}); setSelectedSlot(null); await onRefresh(); showMsg('Lineup saved', 'success') }
    else { const d = await res.json(); showMsg(d.error ?? 'Error saving', 'error') }
    setSaving(false)
  }

  function toggleDrop(slotIndex: number) {
    setDropping(prev => { const next = new Set(prev); next.has(slotIndex) ? next.delete(slotIndex) : next.add(slotIndex); return next })
  }

  async function saveDrops() {
    if (dropping.size === 0) { showMsg('No players selected to drop', 'error'); return }
    setSaving(true)
    const slots = Array.from(dropping).map(slotIndex => ({ slot_index: slotIndex, player_id: null }))
    const res = await apiFetch('/api/roster/update-batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots }),
    })
    if (res.ok) { setDropMode(false); setDropping(new Set()); await onRefresh(); showMsg(`${slots.length} player${slots.length !== 1 ? 's' : ''} released`, 'success') }
    else { const d = await res.json(); showMsg(d.error ?? 'Error dropping players', 'error') }
    setSaving(false)
  }

  async function saveTeamName() {
    if (!nameInput.trim()) return
    setNameSaving(true)
    const res = await apiFetch('/api/roster/update-team-name', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: myTeamId, name: nameInput.trim() }),
    })
    if (res.ok) { onRefresh(); setEditingName(false) }
    else { const d = await res.json(); showMsg(d.error ?? 'Error', 'error') }
    setNameSaving(false)
  }

  const weekPts = (p: Player) => {
    const isDouble = pllDoubleHeaders.some(dh => dh.week === week && dh.pll_team === p.pll_team)
    const gameA = scores.find(s => s.player_id === p.id && s.week === week && s.game === 'A')?.points ?? 0
    const gameB = scores.find(s => s.player_id === p.id && s.week === week && s.game === 'B')?.points ?? null
    if (isDouble && gameB !== null) return Math.round(((gameA + gameB) / 2) * 100) / 100
    return gameA
  }

  const hasPendingSwaps = Object.keys(pending).length > 0

  const slotRow = (i: number) => {
    const player = getPlayerAtSlot(i)
    const isSelected = selectedSlot === i
    const isPending = i in pending
    const isMarkedDrop = dropMode && dropping.has(i)
    const pts = player ? weekPts(player) : null

    let borderColor = 'var(--navy-border)'
    let bg: string | undefined
    if (isMarkedDrop) { borderColor = 'var(--red)'; bg = '#1a0808' }
    else if (isSelected) { borderColor = 'var(--gold)'; bg = '#1a1a08' }
    else if (isPending) borderColor = 'var(--gold-dark)'

    return (
      <div key={i} className="roster-slot"
        style={{ border: `1px solid ${borderColor}`, background: bg, cursor: !dropMode ? 'pointer' : undefined }}
        onClick={() => handleSlotTap(i)}
      >
        <div>
          <div className="slot-label">{SLOT_LABELS[i]}</div>
          {player && !isMarkedDrop && <span className={`pos pos-${player.position}`}>{player.position}</span>}
        </div>
        <div>
          {player ? (
            <div>
              <div style={{ fontSize: 12, fontFamily: 'sans-serif', textDecoration: isMarkedDrop ? 'line-through' : undefined, color: isMarkedDrop ? '#e06060' : isSelected ? 'var(--gold)' : undefined }}>
                {player.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{player.pll_team}</div>
            </div>
          ) : <div className="slot-empty">{isSelected ? '← select destination' : 'Empty'}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          {pts != null && !isMarkedDrop && <span style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'sans-serif' }}>{pts}</span>}
          {isPending && !isMarkedDrop && <span style={{ fontSize: 9, color: 'var(--gold-dark)', fontFamily: 'sans-serif', letterSpacing: '.5px' }}>MOVED</span>}
          {dropMode && player && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }} onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={dropping.has(i)} onChange={() => toggleDrop(i)}
                style={{ accentColor: '#e06060', width: 15, height: 15, cursor: 'pointer' }} />
              <span style={{ fontSize: 11, color: '#e06060', fontFamily: 'sans-serif' }}>Drop</span>
            </label>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {editingName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" style={{ maxWidth: 260 }} value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTeamName(); if (e.key === 'Escape') setEditingName(false) }}
              autoFocus />
            <button className="btn btn-sm btn-gold" onClick={saveTeamName} disabled={nameSaving}>{nameSaving ? 'Saving...' : 'Save'}</button>
            <button className="btn btn-sm btn-outline" onClick={() => setEditingName(false)}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)', fontFamily: 'sans-serif' }}>{myTeam?.name}</div>
            <button className="btn btn-sm btn-outline" onClick={() => { setNameInput(myTeam?.name ?? ''); setEditingName(true) }}>Rename</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 18 }}>
        <div className="stat-chip"><div className="stat-val">{weekScore}</div><div className="stat-lbl">Wk {week} Score</div></div>
        <div className="stat-chip"><div className="stat-val">{record.wins}-{record.losses}</div><div className="stat-lbl">Record</div></div>
        <div className="stat-chip"><div className="stat-val">{record.points_for}</div><div className="stat-lbl">Points For</div></div>
      </div>

      {msg && (
        <div style={{ padding: '7px 12px', borderRadius: 5, fontSize: 12, fontFamily: 'sans-serif', marginBottom: 12,
          background: msg.type === 'error' ? '#3a1a1a' : '#1a3a2a',
          border: `1px solid ${msg.type === 'error' ? 'var(--red)' : 'var(--green)'}`,
          color: msg.type === 'error' ? '#e06060' : 'var(--green)' }}>
          {msg.text}
        </div>
      )}

      {dropMode ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1a0808', border: '1px solid var(--red)', borderRadius: 7, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontFamily: 'sans-serif', color: '#e06060' }}>
            {dropping.size > 0 ? `${dropping.size} player${dropping.size !== 1 ? 's' : ''} selected` : 'Check players to release'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-outline" onClick={() => { setDropMode(false); setDropping(new Set()) }} disabled={saving}>Cancel</button>
            <button className="btn btn-sm btn-danger" onClick={saveDrops} disabled={saving || dropping.size === 0}>
              {saving ? 'Saving...' : `Drop${dropping.size > 0 ? ` (${dropping.size})` : ''}`}
            </button>
          </div>
        </div>
      ) : hasPendingSwaps ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1a1a08', border: '1px solid var(--gold-dark)', borderRadius: 7, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--gold)', fontFamily: 'sans-serif' }}>
            {Math.floor(Object.keys(pending).length / 2)} swap{Math.floor(Object.keys(pending).length / 2) !== 1 ? 's' : ''} pending
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-outline" onClick={() => { setPending({}); setSelectedSlot(null) }} disabled={saving}>Discard</button>
            <button className="btn btn-sm btn-gold" onClick={saveSwaps} disabled={saving}>{saving ? 'Saving...' : 'Save Lineup'}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'sans-serif' }}>Tap a player then tap destination to swap</div>
          <button className="btn btn-sm btn-danger" onClick={() => { setDropMode(true); setSelectedSlot(null); setPending({}) }}>Drop Players</button>
        </div>
      )}

      <div>
        <div className="section-title">Roster</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Starters</div>
        {Array.from({ length: 10 }, (_, i) => slotRow(i))}
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 14, marginBottom: 6 }}>Bench</div>
        {Array.from({ length: 4 }, (_, i) => slotRow(10 + i))}
      </div>
    </div>
  )
}
