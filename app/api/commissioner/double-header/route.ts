// app/api/commissioner/double-header/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_commissioner').eq('id', user.id).single()
  if (!profile?.is_commissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { week, pll_team } = await req.json()
  if (!week || !pll_team) return NextResponse.json({ error: 'Missing week or pll_team' }, { status: 400 })

  const { error } = await admin
    .from('pll_double_headers')
    .insert({ week, pll_team })
    .select()

  if (error && error.code === '23505') {
    return NextResponse.json({ error: `${pll_team} already marked as double-header for week ${week}` }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_commissioner').eq('id', user.id).single()
  if (!profile?.is_commissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { week, pll_team } = await req.json()
  if (!week || !pll_team) return NextResponse.json({ error: 'Missing week or pll_team' }, { status: 400 })

  const { error } = await admin
    .from('pll_double_headers')
    .delete()
    .eq('week', week)
    .eq('pll_team', pll_team)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
