'use client'
// app/components/TransactionsTab.tsx

import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api-fetch'
import { createSupabaseBrowserClient } from '../lib/supabase-browser'
import type { FantasyTeam, Player } from '../types'
import { shortName } from '../types'

interface Props {
  myTeamId: number | null
  teams: FantasyTeam[]
  players: Player[]
  onRefresh: () => void
}

interface Transaction {
  id: number
  team_id: number
  type: 'add' | 'drop'
  player_id: number
  transaction_group: string
  created_at: string
}

interface Trade {
  id: number
  proposing_team_id: number
  receiving_team_id: number
  status: string
  created_at: string
  updated_at: string
  trade_assets: { id: number; trade_id: number; team_id: number; player_id: number }[]
}

interface GroupedTransaction {
  group: string
  team_id: number
  timestamp: string
  adds: Transaction[]
  drops: Transaction[]
}

export default function TransactionsTab({ myTeamId, teams, players, onRefresh }: Props) {
  const [subTab, setSubTab] = useState<'activity' | 'trades'>('activity')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    Promise.all([
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('trades').select('*, trade_assets(*)').order('created_at', { ascending: false }),
    ]).then(([{ data: txData }, { data: tradeData }]) => {
      setTransactions(txData ?? [])
      setTrades((tradeData ?? []) as Trade[])
      setLoading(false)
    })
  }, [])

  const myTrades = trades.filter(t => t.proposing_team_id === myTeamId || t.receiving_team_id === myTeamId)
  const pendingIncoming = myTrades.filter(t => t.receiving_team_id === myTeamId && t.status === 'pending')

  async function refreshTrades() {
    const { data } = await supabase.from('trades').select('*, trade_assets(*)').order('created_at', { ascending: false })
    setTrades((data ?? []) as Trade[])
  }

  function showMsg(text: string, type: 'success' | 'error') {
    setMsg({ text, type }); setTimeout(() => setMsg(null), 4000)
  }

  async function respondToTrade(tradeId: number, action: 'accept' | 'decline' | 'cancel') {
    setSaving(true)
    const res = await apiFetch('/api/trades/respond', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trade_id: tradeId, action }),
    })
    if (res.ok) {
      const labels: Record<string, string> = { accept: 'Trade accepted — awaiting commissioner approval', decline: 'Trade declined', cancel: 'Trade offer cancelled' }
      showMsg(labels[action], 'success')
      await refreshTrades()
      onRefresh()
    } else {
      const d = await res.json(); showMsg(d.error ?? 'Error', 'error')
    }
    setSaving(false)
  }

  // Group transactions
  const grouped: GroupedTransaction[] = []
  const seen = new Map<string, GroupedTransaction>()
  for (const t of transactions) {
    if (!seen.has(t.transaction_group)) {
      const g: GroupedTransaction = { group: t.transaction_group, team_id: t.team_id, timestamp: t.created_at, adds: [], drops: [] }
      seen.set(t.transaction_group, g); grouped.push(g)
    }
    const g = seen.get(t.transaction_group)!
    if (t.type === 'add') g.adds.push(t); else g.drops.push(t)
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  function statusColor(s: string) {
    if (s === 'pending') return 'var(--gold)'
    if (s === 'accepted') return '#6ab0e8'
    if (s === 'completed') return 'var(--green)'
    if (s === 'declined' || s === 'vetoed') return '#e06060'
    return 'var(--muted)'
  }

  function statusLabel(s: string) {
    const map: Record<string, string> = { pending: 'Pending Response', accepted: 'Awaiting Approval', completed: 'Completed', declined: 'Declined', vetoed: 'Vetoed', cancelled: 'Cancelled' }
    return map[s] ?? s
  }

  if (loading) return <div style={{ color: 'var(--muted)', fontFamily: 'sans-serif', fontSize: 13, padding: '20px 0' }}>Loading...</div>

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button onClick={() => setSubTab('activity')} className={`btn btn-sm ${subTab === 'activity' ? 'btn-gold' : 'btn-outline'}`}>
          Activity
        </button>
        <button onClick={() => setSubTab('trades')} className={`btn btn-sm ${subTab === 'trades' ? 'btn-gold' : 'btn-outline'}`} style={{ position: 'relative' }}>
          Trades
          {pendingIncoming.length > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', border: '1px solid var(--navy)' }} />
          )}
        </button>
      </div>

      {msg && (
        <div style={{ padding: '7px 12px', borderRadius: 5, fontSize: 12, fontFamily: 'sans-serif', marginBottom: 12,
          background: msg.type === 'error' ? '#3a1a1a' : '#1a3a2a',
          border: `1px solid ${msg.type === 'error' ? 'var(--red)' : 'var(--green)'}`,
          color: msg.type === 'error' ? '#e06060' : 'var(--green)' }}>
          {msg.text}
        </div>
      )}

      {/* Activity */}
      {subTab === 'activity' && (
        <div>
          {grouped.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontFamily: 'sans-serif', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No transactions yet.</div>
          ) : grouped.map(g => {
            const team = teams.find(t => t.id === g.team_id)
            return (
              <div key={g.group} style={{ border: '1px solid var(--navy-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif' }}>{team?.name ?? 'Unknown'}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{formatTime(g.timestamp)}</div>
                </div>
                {g.adds.map(t => {
                  const player = players.find(p => p.id === t.player_id)
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: '1px solid var(--navy-border)' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', fontFamily: 'sans-serif', minWidth: 32 }}>ADD</span>
                      {player && <span className={`pos pos-${player.position}`} style={{ fontSize: 9 }}>{player.position}</span>}
                      <span style={{ fontSize: 12, fontFamily: 'sans-serif' }}>{player ? shortName(player.name) : '—'}</span>
                      {player && <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{player.pll_team}</span>}
                    </div>
                  )
                })}
                {g.drops.map(t => {
                  const player = players.find(p => p.id === t.player_id)
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: '1px solid var(--navy-border)' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#e06060', fontFamily: 'sans-serif', minWidth: 32 }}>DROP</span>
                      {player && <span className={`pos pos-${player.position}`} style={{ fontSize: 9 }}>{player.position}</span>}
                      <span style={{ fontSize: 12, fontFamily: 'sans-serif', color: 'var(--muted)', textDecoration: 'line-through' }}>{player ? shortName(player.name) : '—'}</span>
                      {player && <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{player.pll_team}</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Trades */}
      {subTab === 'trades' && (
        <div>
          {myTrades.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontFamily: 'sans-serif', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No trades yet.</div>
          ) : myTrades.map(trade => {
            const propTeam = teams.find(t => t.id === trade.proposing_team_id)
            const recvTeam = teams.find(t => t.id === trade.receiving_team_id)
            const propAssets = trade.trade_assets.filter(a => a.team_id === trade.proposing_team_id)
            const recvAssets = trade.trade_assets.filter(a => a.team_id === trade.receiving_team_id)
            const isIncoming = trade.receiving_team_id === myTeamId && trade.status === 'pending'
            const isOutgoing = trade.proposing_team_id === myTeamId && trade.status === 'pending'

            return (
              <div key={trade.id} style={{ border: `1px solid ${isIncoming ? 'var(--gold-dark)' : 'var(--navy-border)'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontFamily: 'sans-serif', color: 'var(--muted)' }}>{propTeam?.name} → {recvTeam?.name}</div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: statusColor(trade.status), fontFamily: 'sans-serif' }}>{statusLabel(trade.status)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'sans-serif', marginBottom: 4 }}>{propTeam?.name} sends</div>
                    {propAssets.map(a => {
                      const p = players.find(pl => pl.id === a.player_id)
                      return p ? (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                          <span className={`pos pos-${p.position}`} style={{ fontSize: 8 }}>{p.position}</span>
                          <span style={{ fontSize: 11, fontFamily: 'sans-serif' }}>{shortName(p.name)}</span>
                        </div>
                      ) : null
                    })}
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'sans-serif', marginBottom: 4 }}>{recvTeam?.name} sends</div>
                    {recvAssets.map(a => {
                      const p = players.find(pl => pl.id === a.player_id)
                      return p ? (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                          <span className={`pos pos-${p.position}`} style={{ fontSize: 8 }}>{p.position}</span>
                          <span style={{ fontSize: 11, fontFamily: 'sans-serif' }}>{shortName(p.name)}</span>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
                {isIncoming && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-success" onClick={() => respondToTrade(trade.id, 'accept')} disabled={saving} style={{ flex: 1 }}>Accept</button>
                    <button className="btn btn-sm btn-danger" onClick={() => respondToTrade(trade.id, 'decline')} disabled={saving} style={{ flex: 1 }}>Decline</button>
                  </div>
                )}
                {isOutgoing && (
                  <button className="btn btn-sm btn-outline" onClick={() => respondToTrade(trade.id, 'cancel')} disabled={saving} style={{ width: '100%', fontSize: 11 }}>Cancel Offer</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
