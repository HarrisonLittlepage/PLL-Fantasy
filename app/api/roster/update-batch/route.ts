// app/api/roster/update-batch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

const SLOT_POSITIONS = ['FO','A','A','M','M','D','D','G','FLEX','FLEX','BN','BN','BN','BN']
const ELIGIBLE: Record<string, string[]> = {
  FO:   ['FO'],
  A:    ['A'],
  M:    ['M', 'SSDM'],
  D:    ['D', 'SSDM', 'LSM'],
  G:    ['G'],
  FLEX: ['A', 'M', 'D', 'SSDM', 'LSM', 'FO'],
  BN:   ['A', 'M', 'D', 'SSDM', 'LSM', 'FO', 'G'],
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('team_id').eq('id', user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  const { slots } = await req.json()
  if (!Array.isArray(slots) || slots.length === 0)
    return NextResponse.json({ error: 'No slots provided' }, { status: 400 })

  const { data: settings } = await admin.from('league_settings').select('locked_pll_teams').eq('id', 1).single()
  const lockedTeams: string[] = settings?.locked_pll_teams ?? []

  const playerIds = slots.map((s: any) => s.player_id).filter(Boolean)
  let playerMap: Record<number, { position: string; pll_team: string }> = {}
  if (playerIds.length > 0) {
    const { data: rows } = await admin.from('players').select('id, position, pll_team').in('id', playerIds)
    playerMap = Object.fromEntries((rows ?? []).map(p => [p.id, p]))
  }

  const { data: currentRoster } = await admin.from('rosters').select('slot_index, player_id').eq('team_id', profile.team_id)
  const currentMap: Record<number, number | null> = {}
  for (const r of currentRoster ?? []) currentMap[r.slot_index] = r.player_id

  for (const slot of slots) {
    const { slot_index, player_id } = slot
    if (slot_index < 0 || slot_index > 13)
      return NextResponse.json({ error: `Invalid slot index: ${slot_index}` }, { status: 400 })

    if (player_id) {
      const player = playerMap[player_id]
      if (!player) return NextResponse.json({ error: `Player ${player_id} not found` }, { status: 400 })
      if (!ELIGIBLE[SLOT_POSITIONS[slot_index]]?.includes(player.position))
        return NextResponse.json({ error: `${player.position} cannot play ${SLOT_POSITIONS[slot_index]}` }, { status: 400 })
      if (lockedTeams.includes(player.pll_team))
        return NextResponse.json({ error: `${player.pll_team} players are locked during live games` }, { status: 423 })
      const { data: other } = await admin.from('rosters').select('team_id').eq('player_id', player_id).neq('team_id', profile.team_id).single()
      if (other) return NextResponse.json({ error: 'Player is on another team' }, { status: 409 })
    }

    const outgoingPlayerId = currentMap[slot_index]
    if (outgoingPlayerId && outgoingPlayerId !== player_id) {
      const { data: outPlayer } = await admin.from('players').select('pll_team').eq('id', outgoingPlayerId).single()
      if (outPlayer && lockedTeams.includes(outPlayer.pll_team)) {
        return NextResponse.json({ error: `${outPlayer.pll_team} players are locked during live games` }, { status: 423 })
      }
    }
  }

  const rMap: Record<number, any> = { ...currentMap }
  for (const s of slots) rMap[s.slot_index] = s.player_id ?? null
  if (Object.values(rMap).filter(Boolean).length > 14)
    return NextResponse.json({ error: 'Roster cannot exceed 14 players' }, { status: 400 })

  const { error } = await admin.from('rosters').upsert(
    slots.map((s: any) => ({
      team_id: profile.team_id,
      slot_index: s.slot_index,
      player_id: s.player_id ?? null,
      updated_at: new Date().toISOString()
    })),
    { onConflict: 'team_id,slot_index' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log transactions
  const allOwnedIds = new Set(Object.values(currentMap).filter(Boolean))
  const txRows: any[] = []

  for (const slot of slots) {
    const prevPlayerId = currentMap[slot.slot_index] ?? null
    const newPlayerId = slot.player_id ?? null

    // Solo drop: slot cleared
    if (prevPlayerId && !newPlayerId) {
      txRows.push({
        team_id: profile.team_id,
        type: 'drop',
        player_id: prevPlayerId,
        transaction_group: generateUUID(),
      })
    }

    // Add: new player who wasn't previously on this team
    if (newPlayerId && !allOwnedIds.has(newPlayerId)) {
      txRows.push({
        team_id: profile.team_id,
        type: 'add',
        player_id: newPlayerId,
        transaction_group: generateUUID(),
      })
    }
  }

  if (txRows.length > 0) {
    await admin.from('transactions').insert(txRows)
  }

  return NextResponse.json({ success: true, updated: slots.length })
}
