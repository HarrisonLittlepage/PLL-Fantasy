'use client'
// app/components/TransactionsTab.tsx

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '../lib/supabase-browser'
import type { FantasyTeam, Player } from '../types'
import { shortName } from '../types'

interface Props {
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

interface GroupedTransaction {
  group: string
  team_id: number
  timestamp: string
  adds: Transaction[]
  drops: Transaction[]
}

export default function TransactionsTab({ teams, players }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setTransactions(data ?? [])
        setLoading(false)
      })
  }, [])

  // Group by transaction_group
  const grouped: GroupedTransaction[] = []
  const seen = new Map<string, GroupedTransaction>()

  for (const t of transactions) {
    if (!seen.has(t.transaction_group)) {
      const g: GroupedTransaction = {
        group: t.transaction_group,
        team_id: t.team_id,
        timestamp: t.created_at,
        adds: [],
        drops: [],
      }
      seen.set(t.transaction_group, g)
      grouped.push(g)
    }
    const g = seen.get(t.transaction_group)!
    if (t.type === 'add') g.adds.push(t)
    else g.drops.push(t)
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  if (loading) return (
    <div style={{ color: 'var(--muted)', fontFamily: 'sans-serif', fontSize: 13, padding: '20px 0' }}>
      Loading transactions...
    </div>
  )

  if (grouped.length === 0) return (
    <div style={{ color: 'var(--muted)', fontFamily: 'sans-serif', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
      No transactions yet.
    </div>
  )

  return (
    <div>
      <div className="section-title">Transactions</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {grouped.map(g => {
          const team = teams.find(t => t.id === g.team_id)
          return (
            <div key={g.group} style={{ border: '1px solid var(--navy-border)', borderRadius: 8, padding: '10px 14px' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', color: 'var(--text)' }}>
                  {team?.name ?? 'Unknown'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                  {formatTime(g.timestamp)}
                </div>
              </div>
              {/* Adds */}
              {g.adds.map(t => {
                const player = players.find(p => p.id === t.player_id)
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: '1px solid var(--navy-border)' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', fontFamily: 'sans-serif', minWidth: 32 }}>ADD</span>
                    {player && <span className={`pos pos-${player.position}`} style={{ fontSize: 9 }}>{player.position}</span>}
                    <span style={{ fontSize: 12, fontFamily: 'sans-serif', color: 'var(--text)' }}>
                      {player ? shortName(player.name) : '—'}
                    </span>
                    {player && <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{player.pll_team}</span>}
                  </div>
                )
              })}
              {/* Drops */}
              {g.drops.map(t => {
                const player = players.find(p => p.id === t.player_id)
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: '1px solid var(--navy-border)' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#e06060', fontFamily: 'sans-serif', minWidth: 32 }}>DROP</span>
                    {player && <span className={`pos pos-${player.position}`} style={{ fontSize: 9 }}>{player.position}</span>}
                    <span style={{ fontSize: 12, fontFamily: 'sans-serif', color: 'var(--muted)', textDecoration: 'line-through' }}>
                      {player ? shortName(player.name) : '—'}
                    </span>
                    {player && <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{player.pll_team}</span>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
