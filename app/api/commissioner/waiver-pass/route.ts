// app/api/roster/waiver-pass/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('team_id').eq('id', user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  const { data: settings } = await admin
    .from('league_settings')
    .select('waiver_state, waiver_order, waiver_current_idx')
    .eq('id', 1).single()

  if (settings?.waiver_state !== 'open') {
    return NextResponse.json({ error: 'Waivers are not open' }, { status: 400 })
  }

  const order: number[] = settings.waiver_order ?? []
  const idx: number = settings.waiver_current_idx ?? 0
  const currentTeamId = order[idx % order.length]

  if (currentTeamId !== profile.team_id) {
    return NextResponse.json({ error: "It's not your turn" }, { status: 403 })
  }

  const { error } = await admin.from('league_settings').update({
    waiver_current_idx: idx + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, next_idx: idx + 1 })
}
