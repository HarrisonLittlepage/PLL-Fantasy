// app/api/roster/add-drop/route.ts
// Atomically adds a free agent and drops a rostered player in one transaction

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

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

  const { add_player_id, drop_slot_index, is_waiver } = await req.json()
  if (!add_player_id || drop_slot_index === undefined) {
    return NextResponse.json({ error: 'add_player_id and drop_slot_index required' }, { status: 400 })
  }

  const { data: settings } = await admin.from('league_settings')
    .select('locked_pll_teams, waiver_state, waiver_order, waiver_current_idx')
    .eq('id', 1).single()

  const lockedTeams: string[] = settings?.locked_pll_teams ?? []

  const { data: existing } = await admin.from('rosters').select('team_id').eq('player_id', add_player_id).single()
  if (existing) return NextResponse.json({ error: 'Player is already on a roster' }, { status: 409 })

  const { data: addPlayer } = await admin.from('players').select('pll_team, name').eq('id', add_player_id).single()
  if (!addPlayer) return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  if (lockedTeams.includes(addPlayer.pll_team)) {
    return NextResponse.json({ error: `${addPlayer.pll_team} players are locked during live games` }, { status: 423 })
  }

  if (is_waiver) {
    if (settings?.waiver_state !== 'open') {
      return NextResponse.json({ error: 'Waivers are not open' }, { status: 400 })
    }
    const order: number[] = settings.waiver_order ?? []
    const idx: number = settings.waiver_current_idx ?? 0
    const currentTeamId = order[idx % order.length]
    if (currentTeamId !== profile.team_id) {
      return NextResponse.json({ error: "It's not your turn" }, { status: 403 })
    }
  }

  const { data: dropSlot } = await admin.from('rosters')
    .select('player_id').eq('team_id', profile.team_id).eq('slot_index', drop_slot_index).single()
  if (!dropSlot) return NextResponse.json({ error: 'Drop slot not found' }, { status: 404 })

  if (dropSlot.player_id) {
    const { data: dropPlayer } = await admin.from('players').select('pll_team').eq('id', dropSlot.player_id).single()
    if (dropPlayer && lockedTeams.includes(dropPlayer.pll_team)) {
      return NextResponse.json({ error: `${dropPlayer.pll_team} players are locked during live games` }, { status: 423 })
    }
  }

  const { error } = await admin.from('rosters').update({
    player_id: add_player_id,
    updated_at: new Date().toISOString(),
  }).eq('team_id', profile.team_id).eq('slot_index', drop_slot_index)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log transaction — add and drop share the same group UUID
  const group = generateUUID()
  const txRows: any[] = [
    { team_id: profile.team_id, type: 'add', player_id: add_player_id, transaction_group: group }
  ]
  if (dropSlot.player_id) {
    txRows.push({ team_id: profile.team_id, type: 'drop', player_id: dropSlot.player_id, transaction_group: group })
  }
  await admin.from('transactions').insert(txRows)

  // Advance waiver turn if needed
  if (is_waiver && settings) {
    const idx: number = settings.waiver_current_idx ?? 0
    await admin.from('league_settings').update({
      waiver_current_idx: idx + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
  }

  return NextResponse.json({ success: true, dropped_slot: drop_slot_index, added_player: addPlayer.name })
}
