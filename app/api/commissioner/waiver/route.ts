// app/api/commissioner/waiver/route.ts
// Open, close, and advance the waiver wire

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_commissioner')
    .eq('id', user.id)
    .single()
  if (!profile?.is_commissioner)
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { action, waiver_order } = await req.json()

  if (action === 'open') {
    // waiver_order is array of team_ids in reverse standings order (passed from client)
    if (!Array.isArray(waiver_order) || waiver_order.length === 0) {
      return NextResponse.json({ error: 'waiver_order required to open waivers' }, { status: 400 })
    }
    const { error } = await admin
      .from('league_settings')
      .update({
        waiver_state: 'open',
        waiver_order,
        waiver_current_idx: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, action: 'opened' })
  }

  if (action === 'close') {
    const { error } = await admin
      .from('league_settings')
      .update({
        waiver_state: null,
        waiver_order: [],
        waiver_current_idx: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, action: 'closed' })
  }

  if (action === 'advance') {
    // Commissioner manually advances turn
    const { data: settings } = await admin
      .from('league_settings')
      .select('waiver_order, waiver_current_idx')
      .eq('id', 1)
      .single()
    if (!settings) return NextResponse.json({ error: 'Settings not found' }, { status: 500 })
    const nextIdx = (settings.waiver_current_idx ?? 0) + 1
    const { error } = await admin
      .from('league_settings')
      .update({
        waiver_current_idx: nextIdx,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, action: 'advanced', new_idx: nextIdx })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
