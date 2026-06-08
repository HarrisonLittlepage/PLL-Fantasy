// app/api/trades/approve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_commissioner').eq('id', user.id).single()
  if (!profile?.is_commissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { trade_id, action } = await req.json()
  if (!trade_id || !action) return NextResponse.json({ error: 'trade_id and action required' }, { status: 400 })
  if (!['approve', 'veto'].includes(action)) return NextResponse.json({ error: 'action must be approve or veto' }, { status: 400 })

  const { data: trade } = await admin.from('trades').select('*').eq('id', trade_id).single()
  if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
  if (trade.status !== 'accepted') return NextResponse.json({ error: 'Trade must be accepted first' }, { status: 400 })

  if (action === 'veto') {
    await admin.from('trades').update({ status: 'vetoed', updated_at: new Date().toISOString() }).eq('id', trade_id)
    return NextResponse.json({ success: true, status: 'vetoed' })
  }

  // Approve — execute the swap
  const { data: assets } = await admin.from('trade_assets').select('*').eq('trade_id', trade_id)
  if (!assets?.length) return NextResponse.json({ error: 'No assets found' }, { status: 400 })

  const propAssets = assets.filter((a: any) => a.team_id === trade.proposing_team_id)
  const recvAssets = assets.filter((a: any) => a.team_id === trade.receiving_team_id)

  async function movePlayer(playerId: number, fromTeamId: number, toTeamId: number): Promise<string | null> {
    // Find player's current slot on fromTeam
    const { data: fromSlot } = await admin.from('rosters').select('slot_index').eq('team_id', fromTeamId).eq('player_id', playerId).single()
    if (!fromSlot) return null

    // Get receiving team roster
    const { data: toRoster } = await admin.from('rosters').select('slot_index, player_id').eq('team_id', toTeamId)
    const toPlayers = (toRoster ?? []).filter((r: any) => r.player_id !== null)

    // Check roster won't exceed 14 after receiving
    // Account for players they're sending away in this trade
    const sendingIds = new Set(propAssets.concat(recvAssets)
      .filter((a: any) => a.team_id === toTeamId)
      .map((a: any) => a.player_id))
    const effectiveCount = toPlayers.filter((r: any) => !sendingIds.has(r.player_id)).length
    if (effectiveCount >= 14) {
      const { data: teamData } = await admin.from('fantasy_teams').select('name').eq('id', toTeamId).single()
      return `${teamData?.name ?? 'A team'} would exceed 14 players — they must drop a player before this trade can be approved`
    }

    // Find first open bench slot on toTeam
    const usedSlots = new Set((toRoster ?? []).filter((r: any) => r.player_id !== null).map((r: any) => r.slot_index))
    let benchSlot = 10
    while (usedSlots.has(benchSlot)) benchSlot++

    // Clear from original slot
    await admin.from('rosters').update({ player_id: null }).eq('team_id', fromTeamId).eq('slot_index', fromSlot.slot_index)
    // Add to new team bench
    await admin.from('rosters').upsert({ team_id: toTeamId, slot_index: benchSlot, player_id: playerId }, { onConflict: 'team_id,slot_index' })
    return null
  }

  // Move proposing team's players to receiving team
  for (const asset of propAssets) {
    const err = await movePlayer(asset.player_id, trade.proposing_team_id, trade.receiving_team_id)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }
  // Move receiving team's players to proposing team
  for (const asset of recvAssets) {
    const err = await movePlayer(asset.player_id, trade.receiving_team_id, trade.proposing_team_id)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }

  await admin.from('trades').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', trade_id)
  return NextResponse.json({ success: true, status: 'completed' })
}
