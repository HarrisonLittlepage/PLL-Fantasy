// app/api/commissioner/roster-lock/route.ts
// Commissioner toggles PLL team roster locks

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

  const { locked_pll_teams } = await req.json()
  if (!Array.isArray(locked_pll_teams)) {
    return NextResponse.json({ error: 'locked_pll_teams must be an array' }, { status: 400 })
  }

  const { error } = await admin
    .from('league_settings')
    .update({ locked_pll_teams, updated_at: new Date().toISOString() })
    .eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, locked_pll_teams })
}
