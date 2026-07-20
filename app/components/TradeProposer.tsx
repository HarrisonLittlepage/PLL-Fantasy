'use client'
// app/components/TradeProposer.tsx

import { apiFetch } from '../lib/api-fetch'
import { useState } from 'react'
import type { FantasyTeam, Player, RosterSlot } from '../types'
import { shortName } from '../types'

interface Props {
  myTeamId: number
  teams: FantasyTeam[]
  players: Player[]
  rosters: RosterSlot[]
  onClose: () => void
  onSuccess: () => void
}

type Step = 'pick_team' | 'pick_their_players' | 'pick_my_players' | 'confirm'

export default function TradeProposer({
  myTeamId,
  teams,
  players,
  rosters,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>('pick_team')
  const [targetTeamId, setTargetTeamId] = useState<number | null>(null)
  const [theirPlayerIds, setTheirPlayerIds] = useState<number[]>([])
  const [myPlayerIds, setMyPlayerIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otherTeams = teams.filter(t => t.id !== myTeamId)
  const targetTeam = teams.find(t => t.id === targetTeamId)
  const myRoster = rosters.filter(r => r.team_id === myTeamId && r.player_id !== null)
  const theirRoster = rosters.filter(r => r.team_id === targetTeamId && r.player_id !== null)

  function getPlayer(id: number) {
    return players.find(p => p.id === id) ?? null
  }

  function toggleId(list: number[], setList: (v: number[]) => void, id: number) {
    list.includes(id) ? setList(list.filter(x => x !== id)) : setList([...list, id])
  }

  async function submit() {
    setSaving(true)
    setError(null)
    const res = await apiFetch('/api/trades/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiving_team_id: targetTeamId,
        offering_player_ids: myPlayerIds,
        requesting_player_ids: theirPlayerIds,
      }),
    })
    if (res.ok) {
      onSuccess()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Error sending trade')
    }
    setSaving(false)
  }

  const playerButton = (
    p: Player,
    selected: boolean,
    onToggle: () => void,
    color: 'green' | 'gold',
  ) => (
    <button
      key={p.id}
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        width: '100%',
        marginBottom: 4,
        cursor: 'pointer',
        background: selected ? (color === 'green' ? '#1a3a2a' : '#1a1a08') : 'var(--navy-light)',
        border: `1px solid ${selected ? (color === 'green' ? 'var(--green)' : 'var(--gold-dark)') : 'var(--navy-border)'}`,
        borderRadius: 6,
        textAlign: 'left',
      }}
    >
      <span className={`pos pos-${p.position}`}>{p.position}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontFamily: 'sans-serif', color: 'var(--text)' }}>
          {shortName(p.name)}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>
          {p.pll_team} · avg {p.avg_pts}
        </div>
      </div>
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          flexShrink: 0,
          border: `2px solid ${selected ? (color === 'green' ? 'var(--green)' : 'var(--gold)') : 'var(--navy-border)'}`,
          background: selected
            ? color === 'green'
              ? 'var(--green)'
              : 'var(--gold)'
            : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && <span style={{ color: '#0a0f1a', fontSize: 12, fontWeight: 700 }}>✓</span>}
      </div>
    </button>
  )

  // Step 1: Pick team
  if (step === 'pick_team')
    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'sans-serif' }}>
            Propose Trade
          </div>
          <button className="btn btn-sm btn-outline" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            fontFamily: 'sans-serif',
            marginBottom: 12,
          }}
        >
          Who do you want to trade with?
        </div>
        {otherTeams.map(team => (
          <button
            key={team.id}
            onClick={() => {
              setTargetTeamId(team.id)
              setStep('pick_their_players')
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              width: '100%',
              marginBottom: 8,
              cursor: 'pointer',
              background: 'var(--navy-light)',
              border: '1px solid var(--navy-border)',
              borderRadius: 8,
              textAlign: 'left',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'sans-serif',
                  color: 'var(--text)',
                }}
              >
                {team.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                {team.owner_name}
              </div>
            </div>
            <span style={{ color: 'var(--muted)', fontSize: 18 }}>›</span>
          </button>
        ))}
      </div>
    )

  // Step 2: Pick their players
  if (step === 'pick_their_players')
    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <button className="btn btn-sm btn-outline" onClick={() => setStep('pick_team')}>
            ← Back
          </button>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif' }}>
            What do you want?
          </div>
          <button
            className="btn btn-sm btn-gold"
            disabled={theirPlayerIds.length === 0}
            onClick={() => setStep('pick_my_players')}
          >
            Next →
          </button>
        </div>
        <div
          style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 8 }}
        >
          {targetTeam?.name}'s roster
        </div>
        {theirRoster.map(slot => {
          const p = getPlayer(slot.player_id!)
          if (!p) return null
          return playerButton(
            p,
            theirPlayerIds.includes(p.id),
            () => toggleId(theirPlayerIds, setTheirPlayerIds, p.id),
            'green',
          )
        })}
      </div>
    )

  // Step 3: Pick my players
  if (step === 'pick_my_players')
    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <button className="btn btn-sm btn-outline" onClick={() => setStep('pick_their_players')}>
            ← Back
          </button>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif' }}>
            What will you offer?
          </div>
          <button
            className="btn btn-sm btn-gold"
            disabled={myPlayerIds.length === 0}
            onClick={() => setStep('confirm')}
          >
            Review →
          </button>
        </div>
        <div
          style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 8 }}
        >
          Your roster
        </div>
        {myRoster.map(slot => {
          const p = getPlayer(slot.player_id!)
          if (!p) return null
          return playerButton(
            p,
            myPlayerIds.includes(p.id),
            () => toggleId(myPlayerIds, setMyPlayerIds, p.id),
            'gold',
          )
        })}
      </div>
    )

  // Step 4: Confirm
  if (step === 'confirm')
    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <button className="btn btn-sm btn-outline" onClick={() => setStep('pick_my_players')}>
            ← Back
          </button>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif' }}>
            Confirm Trade
          </div>
          <div style={{ width: 60 }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 9,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontFamily: 'sans-serif',
              marginBottom: 6,
            }}
          >
            You send to {targetTeam?.name}
          </div>
          {myPlayerIds.map(id => {
            const p = getPlayer(id)!
            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  background: 'var(--navy-light)',
                  borderRadius: 6,
                  marginBottom: 4,
                }}
              >
                <span className={`pos pos-${p.position}`}>{p.position}</span>
                <span style={{ fontSize: 12, fontFamily: 'sans-serif' }}>{shortName(p.name)}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                  {p.pll_team}
                </span>
              </div>
            )
          })}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 9,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontFamily: 'sans-serif',
              marginBottom: 6,
            }}
          >
            You receive from {targetTeam?.name}
          </div>
          {theirPlayerIds.map(id => {
            const p = getPlayer(id)!
            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  background: 'var(--navy-light)',
                  borderRadius: 6,
                  marginBottom: 4,
                }}
              >
                <span className={`pos pos-${p.position}`}>{p.position}</span>
                <span style={{ fontSize: 12, fontFamily: 'sans-serif' }}>{shortName(p.name)}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                  {p.pll_team}
                </span>
              </div>
            )
          })}
        </div>

        {error && (
          <div
            style={{
              padding: '7px 12px',
              background: '#3a1a1a',
              border: '1px solid var(--red)',
              borderRadius: 5,
              fontSize: 12,
              color: '#e06060',
              fontFamily: 'sans-serif',
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Requires {targetTeam?.name} to accept, then commissioner approval.
        </div>

        <button
          className="btn btn-gold"
          onClick={submit}
          disabled={saving}
          style={{ width: '100%' }}
        >
          {saving ? 'Sending...' : 'Send Trade Offer'}
        </button>
      </div>
    )

  return null
}
