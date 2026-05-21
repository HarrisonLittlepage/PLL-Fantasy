'use client'
// app/components/DropPicker.tsx
// Slide-up sheet (mobile) or centered modal (desktop) for add/drop flow

import type { Player, RosterSlot } from '../types'
import { SLOT_LABELS, shortName } from '../types'

interface Props {
  addingPlayer: Player
  myRoster: RosterSlot[]
  players: Player[]
  saving: boolean
  onConfirm: (dropSlotIndex: number) => void
  onCancel: () => void
}

export default function DropPicker({ addingPlayer, myRoster, players, saving, onConfirm, onCancel }: Props) {
  const rosterWithPlayers = myRoster
    .filter(s => s.player_id !== null)
    .sort((a, b) => a.slot_index - b.slot_index)
    .map(s => ({
      slot: s,
      player: players.find(p => p.id === s.player_id) ?? null,
    }))

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 300,
        }}
      />

      {/* Panel — slides up on mobile, centered on desktop */}
      <div style={{
        position: 'fixed',
        zIndex: 301,
        background: 'var(--navy-card)',
        border: '1px solid var(--navy-border)',

        // Mobile: full-width bottom sheet
        bottom: 0,
        left: 0,
        right: 0,
        borderRadius: '14px 14px 0 0',
        maxHeight: '80vh',
        overflowY: 'auto',

        // Desktop override via media query handled inline via class
        padding: '20px 16px 32px',
      }}
      className="drop-picker-panel"
      >
        {/* Handle bar (mobile) */}
        <div style={{ width: 40, height: 4, background: 'var(--navy-border)', borderRadius: 2, margin: '0 auto 16px' }} />

        <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 4 }}>
          Adding
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 12px', background: '#1a3a2a', border: '1px solid var(--green)', borderRadius: 8 }}>
          <span className={`pos pos-${addingPlayer.position}`}>{addingPlayer.position}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'sans-serif', color: 'var(--green)' }}>{shortName(addingPlayer.name)}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{addingPlayer.pll_team}</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>avg {addingPlayer.avg_pts}</div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 8 }}>
          Select a player to drop:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rosterWithPlayers.map(({ slot, player }) => (
            <button
              key={slot.slot_index}
              disabled={saving}
              onClick={() => onConfirm(slot.slot_index)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--navy-border)',
                background: 'var(--navy-light)',
                textAlign: 'left', width: '100%',
                transition: 'border-color .1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--navy-border)')}
            >
              <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', minWidth: 48, fontFamily: 'sans-serif' }}>
                {SLOT_LABELS[slot.slot_index]}
              </div>
              {player && <span className={`pos pos-${player.position}`}>{player.position}</span>}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontFamily: 'sans-serif', color: 'var(--text)' }}>
                  {player ? shortName(player.name) : '—'}
                </div>
                {player && <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{player.pll_team} · avg {player.avg_pts}</div>}
              </div>
              <div style={{ fontSize: 11, color: '#e06060', fontFamily: 'sans-serif', fontWeight: 600 }}>Drop</div>
            </button>
          ))}
        </div>

        <button
          className="btn btn-outline"
          onClick={onCancel}
          disabled={saving}
          style={{ width: '100%', marginTop: 14 }}
        >
          Cancel
        </button>
      </div>
    </>
  )
}
