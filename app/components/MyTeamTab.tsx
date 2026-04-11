'use client'
// app/components/MyTeamTab.tsx

import { apiFetch } from '../lib/api-fetch'
import { useState, useMemo } from 'react'
import type { Player, PlayerScore, RosterSlot, LeagueSettings, WeekSchedule, GamePick, FantasyTeam } from '../types'
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
  onRefresh: () => void
}

type PendingChanges = Record<number, number | null>

function canFitInSlot(player: Player, slotIndex: number): boolean {
  const slotPos = SLOT_POSITIONS[slotIndex]
  return !!(ELIGIBLE_POSITIONS[slotPos]?.includes(player.position))
}

function validateChanges(pending: PendingChanges, players: Player[]): string | null {
  const seen = new Set<number>()
  for (const [slotStr, playerId] of Object.entries(pending)) {
    if (playerId === null) continue
    const slotIndex = parseInt(slotStr)
    const player = players.find(p => p.id === playerId)
    if (!player) continue
    if (!canFitInSlot(player, slotIndex)) {
      return `${player.name} (${player.position}) cannot play ${SLOT_LABELS[slotIndex]}`
    }
    if (seen.has(playerId)) return `${player.name} appears in more than one slot`
    seen.add(playerId)
  }
  return null
}

export default function MyTeamTab({ myTeamId, teams, players, scores, rosters, settings, schedule, gamePicks, onRefresh }: Props) {
  const [pending, setPending] = useState<PendingChanges>({})
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
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

  const savedRoster = rosters.filter(r => r.team_id === myTeamId).sort((a, b) => a.slot_index - b.slot_index)
  const myPick = gamePicks.find(gp => gp.team_id === myTeamId && gp.week === week)?.game_choice ?? 'A'
  const weekScore = getTeamWeekScore(myTeamId, week, rosters, scores, !!isDoubleTeam, byeMode, myPick)
  const record = calcTeamRecord(myTeamId, week - 1, rosters, scores, schedule, [], byeMode, gamePicks)

  // Merge saved + pending into working roster
  const workingRoster = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => {
      const saved = savedRoster.find(r => r.slot_index === i)?.player_id ?? null
      return { slotIndex: i, playerId: i in pending ? pending[i] : saved }
    }),
  [savedRoster, pending])

  const workingPlayerIds = new Set(workingRoster.map(r => r.playerId).filter(Boolean))
  const allOwnedIds = new Set(rosters.map(r => r.player_id).filter(Boolean))
  const hasPendingChanges = Object.keys(pending).length > 0

  function getPlayerAtSlot(i: number): Player | null {
    const pid = workingRoster[i]?.playerId
    return pid ? players.find(p => p.id === pid) ?? null : null
  }

  function isRosterFull() {
    return workingRoster.filter(r => r.playerId !== null).length >= 14
  }

  function showMsg(text: string, type: 'error' | 'success') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  function handleSlotTap(slotIndex: number) {
    // Deselect if tapping selected slot
    if (selectedSlot === slotIndex) { setSelectedSlot(null); return }

    // If another slot is already selected and has a player, attempt swap
    if (selectedSlot !== null && getPlayerAtSlot(selectedSlot) !== null) {
      const fromPlayer = getPlayerAtSlot(selectedSlot)!
      const toPlayer = getPlayerAtSlot(slotIndex)

      if (!canFitInSlot(fromPlayer, slotIndex)) {
        showMsg(`${fromPlayer.name} (${fromPlayer.position}) can't play ${SLOT_LABELS[slotIndex]}`, 'error')
        setSelectedSlot(null)
        return
      }
      if (toPlayer && !canFitInSlot(toPlayer, selectedSlot)) {
        showMsg(`${toPlayer.name} (${toPlayer.position}) can't play ${SLOT_LABELS[selectedSlot]}`, 'error')
        setSelectedSlot(null)
        return
      }

      setPending(prev => ({
        ...prev,
        [selectedSlot]: toPlayer?.id ?? null,
        [slotIndex]: fromPlayer.id,
      }))
      setSelectedSlot(null)
      return
    }

    // Otherwise just select the slot
    setSelectedSlot(slotIndex)
  }

  function placeFA(player: Player, slotIndex: number) {
    if (!canFitInSlot(player, slotIndex)) {
      showMsg(`${player.name} (${player.position}) can't play ${SLOT_LABELS[slotIndex]}`, 'error')
      return
    }
    if (isRosterFull() && workingRoster[slotIndex].playerId === null) {
      showMsg('Roster is full (14/14)', 'error')
      return
    }
    setPending(prev => ({ ...prev, [slotIndex]: player.id }))
    setSelectedSlot(null)
  }

  async function saveChanges() {
    const err = validateChanges(pending, players)
    if (err) { showMsg(err, 'error'); return }

    setSaving(true)
    const slots = Object.entries(pending).map(([slotIndex, player_id]) => ({
      slot_index: parseInt(slotIndex), player_id,
    }))

    const res = await apiFetch('/api/roster/update-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots }),
    })

    if (res.ok) {
      setPending({})
      setSelectedSlot(null)
      await onRefresh()
      showMsg('Roster saved', 'success')
    } else {
      const d = await res.json()
      showMsg(d.error ?? 'Error saving', 'error')
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

  const rightMode: 'idle' | 'swap' | 'fa' = useMemo(() => {
    if (selectedSlot === null) return 'idle'
    return getPlayerAtSlot(selectedSlot) ? 'swap' : 'fa'
  }, [selectedSlot, workingRoster])

  const weekPts = (p: Player) =>
    scores.find(s => s.player_id === p.id && s.week === week && s.game === 'A')?.points ?? null

  const slotRow = (i: number) => {
    const player = getPlayerAtSlot(i)
    const isSelected = selectedSlot === i
    const isPending = i in pending
    const pts = player ? weekPts(player) : null
    return (
      <div
        key={i}
        className="roster-slot"
        style={{
          cursor: 'pointer',
          border: isSelected ? '1px solid var(--gold)' : isPending ? '1px solid var(--gold-dark)' : '1px solid var(--navy-border)',
          background: isSelected ? '#1a1a08' : undefined,
        }}
        onClick={() => handleSlotTap(i)}
      >
        <div>
          <div className="slot-label">{SLOT_LABELS[i]}</div>
          {player && <span className={`pos pos-${player.position}`}>{player.position}</span>}
        </div>
        <div>
          {player ? (
            <div>
              <div style={{ fontSize: 12, fontFamily: 'sans-serif' }}>{player.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{player.pll_team}</div>
            </div>
          ) : <div className="slot-empty">{isSelected ? 'Picking player...' : 'Empty'}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
          {pts != null && <span style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'sans-serif' }}>{pts}</span>}
          {isPending && <span style={{ fontSize: 9, color: 'var(--gold-dark)', fontFamily: 'sans-serif', letterSpacing: '.5px' }}>EDITED</span>}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Team name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {editingName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" style={{ maxWidth: 260 }} value={nameInput} onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTeamName(); if (e.key === 'Escape') setEditingName(false) }} autoFocus />
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

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 18 }}>
        <div className="stat-chip"><div className="stat-val">{weekScore}</div><div className="stat-lbl">Wk {week} Score</div></div>
        <div className="stat-chip"><div className="stat-val">{record.wins}-{record.losses}</div><div className="stat-lbl">Record</div></div>
        <div className="stat-chip"><div className="stat-val">{record.points_for}</div><div className="stat-lbl">Points For</div></div>
      </div>

      {/* Notices */}
      {isByeTeam && <div style={{ padding: '8px 12px', background: '#1a1a20', border: '1px solid var(--navy-border)', borderRadius: 6, fontSize: 12, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 12 }}>Your team is on bye this week.</div>}
      {isDoubleTeam && byeMode === 'pick' && (
        <div style={{ padding: '12px 14px', background: '#1a0f2a', border: '1px solid #4a2060', borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#b06ade', fontFamily: 'sans-serif', fontWeight: 600, marginBottom: 8 }}>Double-header — pick which game counts</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn ${myPick === 'A' ? 'btn-gold' : 'btn-outline'}`} onClick={() => saveGamePick('A')}>Game A</button>
            <button className={`btn ${myPick === 'B' ? 'btn-gold' : 'btn-outline'}`} onClick={() => saveGamePick('B')}>Game B</button>
          </div>
        </div>
      )}
      {isDoubleTeam && byeMode === 'avg' && <div style={{ padding: '8px 12px', background: '#1a0f2a', border: '1px solid #4a2060', borderRadius: 6, fontSize: 12, color: '#b06ade', fontFamily: 'sans-serif', marginBottom: 12 }}>Double-header week — score averaged across both games.</div>}

      {/* Feedback */}
      {msg && (
        <div style={{ padding: '7px 12px', borderRadius: 5, fontSize: 12, fontFamily: 'sans-serif', marginBottom: 12, background: msg.type === 'error' ? '#3a1a1a' : '#1a3a2a', border: `1px solid ${msg.type === 'error' ? 'var(--red)' : 'var(--green)'}`, color: msg.type === 'error' ? '#e06060' : 'var(--green)' }}>
          {msg.text}
        </div>
      )}

      {/* Pending changes bar */}
      {hasPendingChanges && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1a1a08', border: '1px solid var(--gold-dark)', borderRadius: 7, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--gold)', fontFamily: 'sans-serif' }}>
            {Object.keys(pending).length} unsaved change{Object.keys(pending).length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-outline" onClick={() => { setPending({}); setSelectedSlot(null) }} disabled={saving}>Discard</button>
            <button className="btn btn-sm btn-gold" onClick={saveChanges} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      )}

      <div className="grid2">
        {/* Roster */}
        <div>
          <div className="section-title">Roster — tap a slot to edit</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Starters</div>
          {Array.from({ length: 10 }, (_, i) => slotRow(i))}
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 14, marginBottom: 6 }}>Bench</div>
          {Array.from({ length: 4 }, (_, i) => slotRow(10 + i))}
        </div>

        {/* Right panel */}
        <div>
          {rightMode === 'idle' && (
            <div style={{ padding: '20px 14px', color: 'var(--muted)', fontSize: 13, fontFamily: 'sans-serif', lineHeight: 1.7 }}>
              <div className="section-title">How to edit your lineup</div>
              <p style={{ marginBottom: 10 }}><strong style={{ color: 'var(--text)' }}>Swap two players:</strong> Tap the first slot, then tap the second.</p>
              <p style={{ marginBottom: 10 }}><strong style={{ color: 'var(--text)' }}>Move to empty slot:</strong> Tap the player's slot, then tap the empty slot.</p>
              <p style={{ marginBottom: 10 }}><strong style={{ color: 'var(--text)' }}>Add a free agent:</strong> Tap any empty slot to pick from available players.</p>
              <p>Hit <strong style={{ color: 'var(--gold)' }}>Save Changes</strong> when done. Invalid moves are blocked.</p>
            </div>
          )}

          {rightMode === 'swap' && selectedSlot !== null && (
            <SwapPanel
              selectedSlot={selectedSlot}
              workingRoster={workingRoster}
              players={players}
              scores={scores}
              week={week}
              onSwap={(toSlot) => handleSlotTap(toSlot)}
              onCancel={() => setSelectedSlot(null)}
              selectedPlayer={getPlayerAtSlot(selectedSlot)!}
            />
          )}

          {rightMode === 'fa' && selectedSlot !== null && (
            <FAPanel
              selectedSlot={selectedSlot}
              players={players}
              allOwnedIds={allOwnedIds}
              workingPlayerIds={workingPlayerIds}
              scores={scores}
              week={week}
              isRosterFull={isRosterFull()}
              onPick={(p) => placeFA(p, selectedSlot)}
              onCancel={() => setSelectedSlot(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SwapPanel({ selectedSlot, workingRoster, players, scores, week, onSwap, onCancel, selectedPlayer }: {
  selectedSlot: number; workingRoster: any[]; players: Player[]; scores: PlayerScore[]
  week: number; onSwap: (i: number) => void; onCancel: () => void; selectedPlayer: Player
}) {
  const eligible = workingRoster.filter(r => r.slotIndex !== selectedSlot && canFitInSlot(selectedPlayer, r.slotIndex))
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>Move {selectedPlayer.name} to...</div>
        <button className="btn btn-sm btn-outline" onClick={onCancel}>Cancel</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 8 }}>Only eligible slots shown.</div>
      {eligible.map(r => {
        const occ = r.playerId ? players.find((p: Player) => p.id === r.playerId) : null
        const pts = occ ? scores.find(s => s.player_id === occ.id && s.week === week && s.game === 'A')?.points ?? null : null
        return (
          <div key={r.slotIndex} className="roster-slot" style={{ cursor: 'pointer', marginBottom: 3 }}
            onClick={() => onSwap(r.slotIndex)}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-light)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}>
            <div><div className="slot-label">{SLOT_LABELS[r.slotIndex]}</div>{occ && <span className={`pos pos-${occ.position}`}>{occ.position}</span>}</div>
            <div>{occ ? <div><div style={{ fontSize: 12, fontFamily: 'sans-serif' }}>{occ.name}</div><div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{occ.pll_team}</div></div> : <div className="slot-empty">Empty</div>}</div>
            <div style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'sans-serif' }}>{pts != null ? pts : ''}</div>
          </div>
        )
      })}
      {eligible.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'sans-serif', padding: '8px 0' }}>No valid slots to move to.</div>}
    </div>
  )
}

function FAPanel({ selectedSlot, players, allOwnedIds, workingPlayerIds, scores, week, isRosterFull, onPick, onCancel }: {
  selectedSlot: number; players: Player[]; allOwnedIds: Set<any>; workingPlayerIds: Set<any>
  scores: PlayerScore[]; week: number; isRosterFull: boolean; onPick: (p: Player) => void; onCancel: () => void
}) {
  const [search, setSearch] = useState('')
  const eligible = players
    .filter(p => !allOwnedIds.has(p.id) && !workingPlayerIds.has(p.id) && canFitInSlot(p, selectedSlot))
    .filter(p => search === '' || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.avg_pts - a.avg_pts)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>Add to {SLOT_LABELS[selectedSlot]}</div>
        <button className="btn btn-sm btn-outline" onClick={onCancel}>Cancel</button>
      </div>
      {isRosterFull ? (
        <div style={{ padding: '10px 12px', background: '#3a1a1a', border: '1px solid var(--red)', borderRadius: 6, fontSize: 12, color: '#e06060', fontFamily: 'sans-serif' }}>
          Roster is full (14/14). Drop a player before adding.
        </div>
      ) : (
        <>
          <input className="input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 8 }}>{eligible.length} available</div>
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {eligible.map(p => {
              const pts = scores.find(s => s.player_id === p.id && s.week === week && s.game === 'A')?.points ?? null
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 5, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-light)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => onPick(p)}>
                  <span className={`pos pos-${p.position}`}>{p.position}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontFamily: 'sans-serif' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{p.pll_team}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'sans-serif', fontSize: 11 }}>
                    {pts != null && <div style={{ color: 'var(--gold)' }}>{pts} pts</div>}
                    <div style={{ color: 'var(--muted)', fontSize: 10 }}>avg {p.avg_pts}</div>
                  </div>
                </div>
              )
            })}
            {eligible.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'sans-serif', padding: '12px 8px' }}>No eligible free agents.</div>}
          </div>
        </>
      )}
    </div>
  )
}
