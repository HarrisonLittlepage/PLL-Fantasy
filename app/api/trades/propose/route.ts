// app/api/trades/propose/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('team_id').eq('id', user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  const { receiving_team_id, offering_player_ids, requesting_player_ids } = await req.json()

  if (!receiving_team_id) return NextResponse.json({ error: 'receiving_team_id required' }, { status: 400 })
  if (receiving_team_id === profile.team_id) return NextResponse.json({ error: 'Cannot trade with yourself' }, { status: 400 })
  if (!offering_player_ids?.length) return NextResponse.json({ error: 'Must offer at least one player' }, { status: 400 })
  if (!requesting_player_ids?.length) return NextResponse.json({ error: 'Must request at least one player' }, { status: 400 })

  // Verify offering players belong to proposing team
  const { data: mySlots } = await admin.from('rosters').select('player_id').eq('team_id', profile.team_id).in('player_id', offering_player_ids)
  if (!mySlots || mySlots.length !== offering_player_ids.length)
    return NextResponse.json({ error: 'Some offered players are not on your roster' }, { status: 400 })

  // Verify requesting players belong to receiving team
  const { data: theirSlots } = await admin.from('rosters').select('player_id').eq('team_id', receiving_team_id).in('player_id', requesting_player_ids)
  if (!theirSlots || theirSlots.length !== requesting_player_ids.length)
    return NextResponse.json({ error: 'Some requested players are not on that team' }, { status: 400 })

  // Create trade
  const { data: trade, error: tradeError } = await admin.from('trades').insert({
    proposing_team_id: profile.team_id,
    receiving_team_id,
    status: 'pending',
  }).select().single()

  if (tradeError || !trade) return NextResponse.json({ error: tradeError?.message ?? 'Error creating trade' }, { status: 500 })

  // Insert trade assets
  const assets: any[] = [
    ...offering_player_ids.map((pid: number) => ({ trade_id: trade.id, team_id: profile.team_id, player_id: pid })),
    ...requesting_player_ids.map((pid: number) => ({ trade_id: trade.id, team_id: receiving_team_id, player_id: pid })),
  ]

  const { error: assetsError } = await admin.from('trade_assets').insert(assets)
  if (assetsError) return NextResponse.json({ error: assetsError.message }, { status: 500 })

  return NextResponse.json({ success: true, trade_id: trade.id })
}
