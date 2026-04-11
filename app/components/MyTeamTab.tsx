'use client'
// app/components/MyTeamTab.tsx

import { apiFetch } from '../lib/api-fetch'
import { useState, useMemo } from 'react'
import type { Player, PlayerScore, RosterSlot, LeagueSettings, WeekSchedule, GamePick, FantasyTeam } from '../types'
import { SLOT_LABELS } from '../types'
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
  onRefresh: () => void
}

export default function MyTeamTab({ myTeamId, teams, players, scores, rosters, settings, schedule, gamePicks, onRefresh }: Props) {
  const [dropMode, setDropMode] = useState(false)
  const [dropping, setDropping] = useState<Set<number>>(new Set()) // slot indices marked for drop
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null)
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
  const myPick = gamePicks.find(gp => gp.team_id === myTeamId && gp.week === week)?.game_choice ?? 'A'
  const weekScore = getTeamWeekScore(myTeamId, week, rosters, scores, !!isDoubleTeam, byeMode, myPick)
  const record = calcTeamRecord(myTeamId, week - 1, rosters, scores, schedule, [], byeMode, gamePicks)

  function getPlayerAtSlot(i: number): Player | null {
    const slot = myRoster.find(r => r.slot_index === i)
    return slot?.player_id ? players.find(p => p.id === slot.player_id) ?? null : null
  }

  function showMsg(text: string, type: 'error' | 'success') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  function toggleDrop(slotIndex: number) {
    setDropping(prev => {
      const next = new Set(prev)
      if (next.has(slotIndex)) next.delete(slotIndex)
      else next.add(slotIndex)
      return next
    })
  }

  function cancelDropMode() {
    setDropMode(false)
    setDropping(new Set())
  }

  async function saveDrops() {
    if (dropping.size === 0) {
      showMsg('No players selected to drop', 'error')
      return
    }

    setSaving(true)
    const slots = Array.from(dropping).map(slotIndex => ({
      slot_index: slotIndex,
      player_id: null,
    }))

    const res = await apiFetch('/api/roster/update-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots }),
    })

    if (res.ok) {
      setDropMode(false)
      setDropping(new Set())
      await onRefresh()
      showMsg(`${slots.length} player${slots.length !== 1 ? 's' : ''} released`, 'success')
    } else {
      const d = await res.json()
      showMsg(d.error ?? 'Error dropping players', 'error')
    }
    setSaving(false)
  }

  async function saveGamePick(choice: 'A' | 'B') {
    await apiFetch('/api/roster/game-pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week, game_choice: choice }),
    })
    onRefresh()
  }

  async function saveTeamName() {
    if (!nameInput.trim()) return
    setNameSaving(true)
    const res = await apiFetch('/api/roster/update-team-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: myTeamId, name: nameInput.trim() }),
    })
    if (res.ok) { onRefresh(); setEditingName(false) }
    else { const d = await res.json(); showMsg(d.error ?? 'Error', 'error') }
    setNameSaving(false)
  }

  const weekPts = (p: Player) =>
    scores.find(s => s.player_id === p.id && s.week === week && s.game === 'A')?.points ?? null

  return (
    <div>
      {/* Team name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {editingName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" style={{ maxWidth: 260 }} value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTeamName(); if (e.key === 'Escape') setEditingName(false) }}
              autoFocus />
            <button className="btn btn-sm btn-gold" onClick={saveTeamName} disabled={nameSaving}>
              {nameSaving ? 'Saving...' : 'Save'}
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => setEditingName(false)}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)', fontFamily: 'sans-serif' }}>{myTeam?.name}</div>
            <button className="btn btn-sm btn-outline" onClick={() => { setNameInput(myTeam?.name ?? ''); setEditingName(true) }}>
              Rename
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 18 }}>
        <div className="stat-chip"><div className="stat-val">{weekScore}</div><div className="stat-lbl">Wk {week} Score</div></div>
        <div className="stat-chip"><div className="stat-val">{record.wins}-{record.losses}</div><div className="stat-lbl">Record</div></div>
        <div className="stat-chip"><div className="stat-val">{record.points_for}</div><div className="stat-lbl">Points For</div></div>
      </div>

      {/* Notices */}
      {isByeTeam && (
        <div style={{ padding: '8px 12px', background: '#1a1a20', border: '1px solid var(--navy-border)', borderRadius: 6, fontSize: 12, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 12 }}>
          Your team is on bye this week.
        </div>
      )}
      {isDoubleTeam && byeMode === 'pick' && (
        <div style={{ padding: '12px 14px', background: '#1a0f2a', border: '1px solid #4a2060', borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#b06ade', fontFamily: 'sans-serif', fontWeight: 600, marginBottom: 8 }}>
            Double-header — pick which game counts
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn ${myPick === 'A' ? 'btn-gold' : 'btn-outline'}`} onClick={() => saveGamePick('A')}>Game A</button>
            <button className={`btn ${myPick === 'B' ? 'btn-gold' : 'btn-outline'}`} onClick={() => saveGamePick('B')}>Game B</button>
          </div>
        </div>
      )}
      {isDoubleTeam && byeMode === 'avg' && (
        <div style={{ padding: '8px 12px', background: '#1a0f2a', border: '1px solid #4a2060', borderRadius: 6, fontSize: 12, color: '#b06ade', fontFamily: 'sans-serif', marginBottom: 12 }}>
          Double-header week — score averaged across both games.
        </div>
      )}

      {/* Feedback */}
      {msg && (
        <div style={{ padding: '7px 12px', borderRadius: 5, fontSize: 12, fontFamily: 'sans-serif', marginBottom: 12, background: msg.type === 'error' ? '#3a1a1a' : '#1a3a2a', border: `1px solid ${msg.type === 'error' ? 'var(--red)' : 'var(--green)'}`, color: msg.type === 'error' ? '#e06060' : 'var(--green)' }}>
          {msg.text}
        </div>
      )}

      {/* Drop mode bar */}
      {dropMode ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1a0808', border: '1px solid var(--red)', borderRadius: 7, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontFamily: 'sans-serif', color: '#e06060' }}>
            {dropping.size > 0
              ? `${dropping.size} player${dropping.size !== 1 ? 's' : ''} selected to drop`
              : 'Check players to release them'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-outline" onClick={cancelDropMode} disabled={saving}>Cancel</button>
            <button
              className="btn btn-sm btn-danger"
              onClick={saveDrops}
              disabled={saving || dropping.size === 0}
            >
              {saving ? 'Saving...' : `Drop ${dropping.size > 0 ? `(${dropping.size})` : ''}`}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button className="btn btn-sm btn-danger" onClick={() => setDropMode(true)}>
            Drop Players
          </button>
        </div>
      )}

      {/* Roster */}
      <div>
        <div className="section-title">Roster</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Starters</div>
        {Array.from({ length: 10 }, (_, i) => {
          const player = getPlayerAtSlot(i)
          const isMarkedDrop = dropMode && dropping.has(i)
          const pts = player ? weekPts(player) : null

          return (
            <div
              key={i}
              className="roster-slot"
              style={{
                border: isMarkedDrop ? '1px solid var(--red)' : '1px solid var(--navy-border)',
                background: isMarkedDrop ? '#1a0808' : undefined,
              }}
            >
              <div>
                <div className="slot-label">{SLOT_LABELS[i]}</div>
                {player && <span className={`pos pos-${player.position}`}>{player.position}</span>}
              </div>
              <div>
                {player ? (
                  <div>
                    <div style={{ fontSize: 12, fontFamily: 'sans-serif', textDecoration: isMarkedDrop ? 'line-through' : undefined, color: isMarkedDrop ? '#e06060' : undefined }}>
                      {player.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{player.pll_team}</div>
                  </div>
                ) : (
                  <div className="slot-empty">Empty</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                {pts != null && !isMarkedDrop && (
                  <span style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'sans-serif' }}>{pts}</span>
                )}
                {dropMode && player && (
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={dropping.has(i)}
                      onChange={() => toggleDrop(i)}
                      style={{ accentColor: '#e06060', width: 15, height: 15, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 11, color: '#e06060', fontFamily: 'sans-serif' }}>Drop</span>
                  </label>
                )}
              </div>
            </div>
          )
        })}

        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 14, marginBottom: 6 }}>Bench</div>
        {Array.from({ length: 4 }, (_, i) => {
          const slotIndex = 10 + i
          const player = getPlayerAtSlot(slotIndex)
          const isMarkedDrop = dropMode && dropping.has(slotIndex)
          const pts = player ? weekPts(player) : null

          return (
            <div
              key={slotIndex}
              className="roster-slot"
              style={{
                opacity: 0.85,
                border: isMarkedDrop ? '1px solid var(--red)' : '1px solid var(--navy-border)',
                background: isMarkedDrop ? '#1a0808' : undefined,
              }}
            >
              <div>
                <div className="slot-label">{SLOT_LABELS[slotIndex]}</div>
                {player && <span className={`pos pos-${player.position}`}>{player.position}</span>}
              </div>
              <div>
                {player ? (
                  <div>
                    <div style={{ fontSize: 12, fontFamily: 'sans-serif', textDecoration: isMarkedDrop ? 'line-through' : undefined, color: isMarkedDrop ? '#e06060' : undefined }}>
                      {player.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{player.pll_team}</div>
                  </div>
                ) : (
                  <div className="slot-empty">Empty</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                {pts != null && !isMarkedDrop && (
                  <span style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'sans-serif' }}>{pts}</span>
                )}
                {dropMode && player && (
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={dropping.has(slotIndex)}
                      onChange={() => toggleDrop(slotIndex)}
                      style={{ accentColor: '#e06060', width: 15, height: 15, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 11, color: '#e06060', fontFamily: 'sans-serif' }}>Drop</span>
                  </label>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
