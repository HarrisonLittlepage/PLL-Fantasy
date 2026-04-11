// app/api/roster/update-batch/route.ts
// Saves multiple roster slot changes at once. Validates position eligibility
// and ownership server-side so client-side checks can't be bypassed.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../lib/supabase'

const SLOT_POSITIONS = [
  'A','A','M','M','D','D','FO','G','FLEX','FLEX','BN','BN','BN','BN'
]

const ELIGIBLE_POSITIONS: Record<string, string[]> = {
  A:    ['A'],
  M:    ['M','SSDM'],
  D:    ['D','SSDM'],
  FO:   ['FO'],
  G:    ['G'],
  FLEX: ['A','M','D','SSDM','FO'],
  BN:   ['A','M','D','SSDM','FO','G'],
}

export async function POST(req: NextRequest) {
  const browser = createSupabaseServerClient(req)

  // 1. Auth check
  const { data: { user } } = await browser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // 2. Get user's team
  const { data: profile } = await browser
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()
  if (!profile?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  const { slots } = await req.json()
  if (!Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ error: 'No slots provided' }, { status: 400 })
  }

  // 3. Validate each slot
  const admin = createSupabaseAdminClient()

  // Fetch players we need to validate
  const playerIds = slots.map((s: any) => s.player_id).filter(Boolean)

  let playerMap: Record<number, { position: string }> = {}
  if (playerIds.length > 0) {
    const { data: playerRows } = await admin
      .from('players')
      .select('id, position')
      .in('id', playerIds)
    playerMap = Object.fromEntries((playerRows ?? []).map(p => [p.id, p]))
  }

  for (const slot of slots) {
    const { slot_index, player_id } = slot

    if (slot_index < 0 || slot_index > 13) {
      return NextResponse.json({ error: `Invalid slot index: ${slot_index}` }, { status: 400 })
    }

    if (player_id !== null && player_id !== undefined) {
      const player = playerMap[player_id]
      if (!player) return NextResponse.json({ error: `Player ${player_id} not found` }, { status: 400 })

      const slotPos = SLOT_POSITIONS[slot_index]
      const eligible = ELIGIBLE_POSITIONS[slotPos] ?? []
      if (!eligible.includes(player.position)) {
        return NextResponse.json({
          error: `Player position ${player.position} is not eligible for ${slotPos} slot (slot ${slot_index})`
        }, { status: 400 })
      }

      // Check player isn't on another team
      const { data: otherSlot } = await admin
        .from('rosters')
        .select('team_id')
        .eq('player_id', player_id)
        .neq('team_id', profile.team_id)
        .single()
      if (otherSlot) {
        return NextResponse.json({ error: `Player ${player_id} is already on another team` }, { status: 409 })
      }
    }
  }

  // 4. Check roster won't exceed 14 players after changes
  const { data: currentRoster } = await admin
    .from('rosters')
    .select('slot_index, player_id')
    .eq('team_id', profile.team_id)

  // Build the projected roster after applying changes
  const rosterMap: Record<number, number | null> = {}
  for (const row of currentRoster ?? []) {
    rosterMap[row.slot_index] = row.player_id
  }
  for (const slot of slots) {
    rosterMap[slot.slot_index] = slot.player_id ?? null
  }
  const totalPlayers = Object.values(rosterMap).filter(Boolean).length
  if (totalPlayers > 14) {
    return NextResponse.json({ error: 'Roster cannot exceed 14 players' }, { status: 400 })
  }

  // 5. Upsert all slots
  const upsertRows = slots.map((s: any) => ({
    team_id: profile.team_id,
    slot_index: s.slot_index,
    player_id: s.player_id ?? null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await admin
    .from('rosters')
    .upsert(upsertRows, { onConflict: 'team_id,slot_index' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, updated: slots.length })
}
