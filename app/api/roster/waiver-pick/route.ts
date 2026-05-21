// app/api/roster/waiver-pick/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('team_id').eq('id', user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  const { data: settings } = await admin.from('league_settings')
    .select('waiver_state, waiver_order, waiver_current_idx').eq('id', 1).single()

  if (settings?.waiver_state !== 'open') return NextResponse.json({ error: 'Waivers are not open' }, { status: 400 })

  const order: number[] = settings.waiver_order ?? []
  const idx: number = settings.waiver_current_idx ?? 0
  const currentTeamId = order[idx % order.length]
  if (currentTeamId !== profile.team_id) return NextResponse.json({ error: "It's not your turn" }, { status: 403 })

  const { player_id, slot_index } = await req.json()
  if (!player_id || slot_index === undefined) return NextResponse.json({ error: 'player_id and slot_index required' }, { status: 400 })

  const { data: existing } = await admin.from('rosters').select('team_id').eq('player_id', player_id).single()
  if (existing) return NextResponse.json({ error: 'Player is already on a roster' }, { status: 409 })

  const { error: rosterError } = await admin.from('rosters').upsert({
    team_id: profile.team_id, slot_index, player_id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'team_id,slot_index' })
  if (rosterError) return NextResponse.json({ error: rosterError.message }, { status: 500 })

  // Log transaction
  const group = crypto.randomUUID()
  await admin.from('transactions').insert([
    { team_id: profile.team_id, type: 'add', player_id, transaction_group: group }
  ])

  const { error: advanceError } = await admin.from('league_settings').update({
    waiver_current_idx: idx + 1, updated_at: new Date().toISOString(),
  }).eq('id', 1)
  if (advanceError) return NextResponse.json({ error: advanceError.message }, { status: 500 })

  return NextResponse.json({ success: true, next_idx: idx + 1, next_team_id: order[(idx + 1) % order.length] })
}
