'use client'
// app/components/FreeAgentsTab.tsx

import { apiFetch } from '../lib/api-fetch'
import { useState } from 'react'
import type {
  FantasyTeam,
  Player,
  PlayerScore,
  RosterSlot,
  RosterSnapshot,
  LeagueSettings,
  WeekSchedule,
  Matchup,
  GamePick,
  PllDoubleHeader,
} from '../types'
import { shortName } from '../types'
import DropPicker from './DropPicker'

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

export default function FreeAgentsTab({
  myTeamId,
  teams,
  players,
  scores,
  rosters,
  settings,
  onRefresh,
}: Props) {
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [faOnly, setFaOnly] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [dropPickerPlayer, setDropPickerPlayer] = useState<Player | null>(null)

  const week = settings.current_week
  const lockedTeams: string[] = settings.locked_pll_teams ?? []
  const waiverOpen = settings.waiver_state === 'open'

  // Map player_id -> owning team (only counts starters+bench with a player assigned)
  const ownerMap = new Map<number, FantasyTeam>()
  for (const r of rosters) {
    if (r.player_id != null) {
      const team = teams.find(t => t.id === r.team_id)
      if (team) ownerMap.set(r.player_id, team)
    }
  }

  const myRoster = rosters.filter(r => r.team_id === myTeamId)
  const myRosterCount = myRoster.filter(r => r.player_id !== null).length
  const isFull = myRosterCount >= 14

  const displayedPlayers = players
    .filter(
      p =>
        (!faOnly || !ownerMap.has(p.id)) &&
        (filter === 'ALL' || p.position === filter) &&
        (search === '' || p.name.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => Number(b.avg_pts) - Number(a.avg_pts))

  function showMsg(text: string, type: 'success' | 'error') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  async function addPlayer(player: Player) {
    if (waiverOpen) {
      showMsg('Waivers are active — use the Waivers tab to add players', 'error')
      return
    }
    if (lockedTeams.includes(player.pll_team)) {
      showMsg(`${player.pll_team} players are locked during live games`, 'error')
      return
    }

    if (isFull) {
      setDropPickerPlayer(player)
      return
    }

    const usedBenchSlots = new Set(
      myRoster.filter(r => r.slot_index >= 10 && r.player_id !== null).map(r => r.slot_index),
    )
    let benchSlot = 10
    while (usedBenchSlots.has(benchSlot)) benchSlot++

    setSaving(true)
    const res = await apiFetch('/api/roster/update-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: [{ slot_index: benchSlot, player_id: player.id }] }),
    })
    if (res.ok) {
      await onRefresh()
      showMsg(`${shortName(player.name)} added to bench`, 'success')
    } else {
      const d = await res.json()
      showMsg(d.error ?? 'Error adding player', 'error')
    }
    setSaving(false)
  }

  async function handleAddDrop(dropSlotIndex: number) {
    if (!dropPickerPlayer) return
    setSaving(true)
    const res = await apiFetch('/api/roster/add-drop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        add_player_id: dropPickerPlayer.id,
        drop_slot_index: dropSlotIndex,
        is_waiver: false,
      }),
    })
    if (res.ok) {
      const d = await res.json()
      await onRefresh()
      showMsg(
        `${shortName(dropPickerPlayer.name)} added, ${d.dropped_player ?? 'player'} dropped`,
        'success',
      )
      setDropPickerPlayer(null)
    } else {
      const d = await res.json()
      showMsg(d.error ?? 'Error', 'error')
    }
    setSaving(false)
  }

  const weekPts = (p: Player) =>
    scores.find(s => s.player_id === p.id && s.week === week && s.game === 'A')?.points ?? null

  return (
    <div>
      {/* Roster status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 14,
          padding: '8px 12px',
          background: 'var(--navy-light)',
          borderRadius: 7,
          border: '1px solid var(--navy-border)',
        }}
      >
        <div style={{ fontSize: 13, fontFamily: 'sans-serif' }}>
          Roster:{' '}
          <strong style={{ color: isFull ? '#e06060' : 'var(--green)' }}>{myRosterCount}/14</strong>
        </div>
        {isFull ? (
          <div style={{ fontSize: 11, color: '#e06060', fontFamily: 'sans-serif' }}>
            Full — tap Add to add & drop in one move
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>
            Players added to bench. Move to starter slots from My Team.
          </div>
        )}
      </div>

      {waiverOpen && (
        <div
          style={{
            padding: '10px 14px',
            background: '#1a1a08',
            border: '1px solid var(--gold-dark)',
            borderRadius: 6,
            fontSize: 12,
            color: 'var(--gold)',
            fontFamily: 'sans-serif',
            marginBottom: 12,
          }}
        >
          Free Agency is currently closed while Waivers are active.
        </div>
      )}
      {lockedTeams.length > 0 && (
        <div
          style={{
            padding: '7px 12px',
            background: '#1a0808',
            border: '1px solid var(--red)',
            borderRadius: 6,
            fontSize: 12,
            color: '#e06060',
            fontFamily: 'sans-serif',
            marginBottom: 12,
          }}
        >
          🔒 Locked teams (live games): {lockedTeams.join(', ')}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <input
          className="input"
          style={{ flex: 1, minWidth: 140 }}
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-bar" style={{ margin: 0 }}>
          {['ALL', 'A', 'M', 'D', 'SSDM', 'LSM', 'FO', 'G'].map(f => (
            <button
              key={f}
              className={`filter-btn${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div className="section-title" style={{ margin: 0 }}>
          {displayedPlayers.length} {faOnly ? 'available' : 'players'}
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            fontSize: 11,
            color: 'var(--muted)',
            fontFamily: 'sans-serif',
          }}
        >
          Free agents only
          <input
            type="checkbox"
            checked={faOnly}
            onChange={e => setFaOnly(e.target.checked)}
            style={{ accentColor: 'var(--gold)', width: 15, height: 15, cursor: 'pointer' }}
          />
        </label>
      </div>

      {msg && (
        <div
          style={{
            padding: '7px 12px',
            borderRadius: 5,
            fontSize: 12,
            fontFamily: 'sans-serif',
            marginBottom: 10,
            background: msg.type === 'error' ? '#3a1a1a' : '#1a3a2a',
            border: `1px solid ${msg.type === 'error' ? 'var(--red)' : 'var(--green)'}`,
            color: msg.type === 'error' ? '#e06060' : 'var(--green)',
          }}
        >
          {msg.text}
        </div>
      )}

      {displayedPlayers.map(p => {
        const pts = weekPts(p)
        const isLocked = lockedTeams.includes(p.pll_team)
        const owner = ownerMap.get(p.id)
        const isMine = owner?.id === myTeamId
        return (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 8px',
              borderRadius: 5,
              transition: 'background .1s',
              opacity: isLocked ? 0.6 : 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-light)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span className={`pos pos-${p.position}`}>{p.position}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontFamily: 'sans-serif' }}>
                {shortName(p.name)}
                {isLocked && <span style={{ marginLeft: 5, fontSize: 10 }}>🔒</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                {p.pll_team}
              </div>
            </div>
            {owner && (
              <div
                style={{
                  fontSize: 10,
                  fontFamily: 'sans-serif',
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: isMine ? '#1a3a2a' : 'var(--navy-light)',
                  border: `1px solid ${isMine ? 'var(--green)' : 'var(--navy-border)'}`,
                  color: isMine ? 'var(--green)' : 'var(--muted)',
                  whiteSpace: 'nowrap',
                  maxWidth: 100,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {owner.name}
              </div>
            )}
            <div
              style={{ textAlign: 'right', minWidth: 54, fontFamily: 'sans-serif', fontSize: 11 }}
            >
              {pts != null && <div style={{ color: 'var(--gold)' }}>{pts} pts</div>}
              <div style={{ color: 'var(--muted)', fontSize: 10 }}>avg {p.avg_pts}</div>
            </div>
            {!owner && (
              <button
                className="btn btn-sm btn-success"
                disabled={saving || isLocked || waiverOpen}
                onClick={() => addPlayer(p)}
                style={isLocked || waiverOpen ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
              >
                {isLocked ? '🔒' : waiverOpen ? '—' : 'Add'}
              </button>
            )}
          </div>
        )
      })}

      {displayedPlayers.length === 0 && (
        <div
          style={{
            color: 'var(--muted)',
            fontSize: 13,
            fontFamily: 'sans-serif',
            padding: '20px 0',
            textAlign: 'center',
          }}
        >
          No players match your filter.
        </div>
      )}

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
