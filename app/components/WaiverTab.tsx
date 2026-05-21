'use client'
// app/components/WaiverTab.tsx

import { apiFetch } from '../lib/api-fetch'
import { useState } from 'react'
import type { FantasyTeam, Player, PlayerScore, RosterSlot, RosterSnapshot, LeagueSettings, WeekSchedule, Matchup, GamePick, PllDoubleHeader } from '../types'
import { shortName } from '../types'
import DropPicker from './DropPicker'

interface Props {
  myTeamId: number | null
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

export default function WaiverTab({ myTeamId, teams, players, scores, rosters, settings, onRefresh }: Props) {
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [dropPickerPlayer, setDropPickerPlayer] = useState<Player | null>(null)

  const week = settings.current_week
  const waiverOpen = settings.waiver_state === 'open'
  const order: number[] = settings.waiver_order ?? []
  const idx: number = settings.waiver_current_idx ?? 0
  const currentTeamId = waiverOpen ? order[idx % order.length] : null
  const isMyTurn = myTeamId !== null && currentTeamId === myTeamId

  const allOwnedIds = new Set(rosters.map(r => r.player_id).filter(Boolean))
  const myRoster = rosters.filter(r => r.team_id === myTeamId)
  const myRosterCount = myRoster.filter(r => r.player_id !== null).length
  const isFull = myRosterCount >= 14

  const freeAgents = players.filter(p =>
    !allOwnedIds.has(p.id) &&
    (filter === 'ALL' || p.position === filter) &&
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => Number(b.avg_pts) - Number(a.avg_pts))

  function showMsg(text: string, type: 'success' | 'error') {
    setMsg({ text, type }); setTimeout(() => setMsg(null), 4000)
  }

  async function handlePick(player: Player) {
    if (isFull) {
      setDropPickerPlayer(player)
      return
    }

    const benchSlot = [10, 11, 12, 13].find(i => {
      const slot = myRoster.find(r => r.slot_index === i)
      return !slot || slot.player_id === null
    })
    if (benchSlot === undefined) { showMsg('Bench is full — move someone to a starter slot first', 'error'); return }

    setSaving(true)
    const res = await apiFetch('/api/roster/waiver-pick', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: player.id, slot_index: benchSlot }),
    })
    if (res.ok) { await onRefresh(); showMsg(`${shortName(player.name)} added to your bench`, 'success') }
    else { const d = await res.json(); showMsg(d.error ?? 'Error making pick', 'error') }
    setSaving(false)
  }

  async function handleAddDrop(dropSlotIndex: number) {
    if (!dropPickerPlayer) return
    setSaving(true)
    const res = await apiFetch('/api/roster/add-drop', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ add_player_id: dropPickerPlayer.id, drop_slot_index: dropSlotIndex, is_waiver: true }),
    })
    if (res.ok) {
      await onRefresh()
      showMsg(`${shortName(dropPickerPlayer.name)} added`, 'success')
      setDropPickerPlayer(null)
    } else {
      const d = await res.json()
      showMsg(d.error ?? 'Error', 'error')
    }
    setSaving(false)
  }

  async function handlePass() {
    setSaving(true)
    const res = await apiFetch('/api/roster/waiver-pass', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) { await onRefresh(); showMsg('You passed your turn', 'success') }
    else { const d = await res.json(); showMsg(d.error ?? 'Error', 'error') }
    setSaving(false)
  }

  const weekPts = (p: Player) => scores.find(s => s.player_id === p.id && s.week === week && s.game === 'A')?.points ?? null

  if (!waiverOpen) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--muted)', fontFamily: 'sans-serif' }}>
          Waivers are closed
        </div>
      </div>
    )
  }

  const remainingOrder = order.slice(idx % order.length).concat(order.slice(0, idx % order.length))

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div className="section-title">Waiver Pick Order</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {remainingOrder.map((teamId, i) => {
            const team = teams.find(t => t.id === teamId)
            const isCurrent = i === 0
            return (
              <div key={teamId} style={{
                padding: '6px 12px', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 12,
                background: isCurrent ? 'var(--gold)' : 'var(--navy-light)',
                color: isCurrent ? '#0a0f1a' : 'var(--muted)',
                border: `1px solid ${isCurrent ? 'var(--gold)' : 'var(--navy-border)'}`,
                fontWeight: isCurrent ? 700 : 400, whiteSpace: 'nowrap',
              }}>
                {`${i + 1}. `}{team?.name ?? `Team ${teamId}`}
              </div>
            )
          })}
        </div>
      </div>

      {isMyTurn && (
        <div style={{ padding: '12px 16px', background: '#1a3a2a', border: '1px solid var(--green)', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)', fontFamily: 'sans-serif' }}>
            It's your turn to pick!
          </div>
          <button className="btn btn-sm btn-outline" onClick={handlePass} disabled={saving}>Pass</button>
        </div>
      )}

      {!isMyTurn && currentTeamId && (
        <div style={{ padding: '10px 14px', background: 'var(--navy-light)', border: '1px solid var(--navy-border)', borderRadius: 7, marginBottom: 16, fontSize: 13, color: 'var(--muted)', fontFamily: 'sans-serif' }}>
          Waiting for {teams.find(t => t.id === currentTeamId)?.name} to pick...
        </div>
      )}

      {msg && (
        <div style={{ padding: '7px 12px', borderRadius: 5, fontSize: 12, fontFamily: 'sans-serif', marginBottom: 12,
          background: msg.type === 'error' ? '#3a1a1a' : '#1a3a2a',
          border: `1px solid ${msg.type === 'error' ? 'var(--red)' : 'var(--green)'}`,
          color: msg.type === 'error' ? '#e06060' : 'var(--green)' }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Search players..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-bar" style={{ margin: 0 }}>
          {['ALL', 'A', 'M', 'D', 'SSDM', 'LSM', 'FO', 'G'].map(f => (
            <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      <div className="section-title">{freeAgents.length} available</div>

      {freeAgents.map(p => {
        const pts = weekPts(p)
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 5, transition: 'background .1s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-light)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span className={`pos pos-${p.position}`}>{p.position}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontFamily: 'sans-serif' }}>{shortName(p.name)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{p.pll_team}</div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 54, fontFamily: 'sans-serif', fontSize: 11 }}>
              {pts != null && <div style={{ color: 'var(--gold)' }}>{pts} pts</div>}
              <div style={{ color: 'var(--muted)', fontSize: 10 }}>avg {p.avg_pts}</div>
            </div>
            <button
              className="btn btn-sm btn-success"
              disabled={saving || !isMyTurn}
              onClick={() => handlePick(p)}
              style={!isMyTurn ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              {!isMyTurn ? '—' : 'Add'}
            </button>
          </div>
        )
      })}

      {dropPickerPlayer && (
        <DropPicker
          addingPlayer={dropPickerPlayer}
          myRoster={myRoster}
          players={players}
          saving={saving}
          onConfirm={handleAddDrop}
          onCancel={() => setDropPickerPlayer(null)}
        />
      )}
    </div>
  )
}
