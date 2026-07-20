// app/api/trades/respond/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()
  if (!profile?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  const { trade_id, action } = await req.json()
  if (!trade_id || !action)
    return NextResponse.json({ error: 'trade_id and action required' }, { status: 400 })
  if (!['accept', 'decline', 'cancel'].includes(action))
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const { data: trade } = await admin.from('trades').select('*').eq('id', trade_id).single()
  if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 })

  if (action === 'cancel') {
    if (trade.proposing_team_id !== profile.team_id)
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    if (!['pending', 'accepted'].includes(trade.status))
      return NextResponse.json({ error: 'Trade cannot be cancelled' }, { status: 400 })
    await admin
      .from('trades')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', trade_id)
    return NextResponse.json({ success: true, status: 'cancelled' })
  }

  if (trade.receiving_team_id !== profile.team_id)
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  if (trade.status !== 'pending')
    return NextResponse.json({ error: 'Trade is no longer pending' }, { status: 400 })

  const newStatus = action === 'accept' ? 'accepted' : 'declined'
  await admin
    .from('trades')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', trade_id)
  return NextResponse.json({ success: true, status: newStatus })
}
