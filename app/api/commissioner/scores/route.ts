// app/api/commissioner/scores/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_commissioner').eq('id', user.id).single()
  if (!profile?.is_commissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { scores } = await req.json()
  if (!Array.isArray(scores)) return NextResponse.json({ error: 'scores must be an array' }, { status: 400 })

  const { error } = await admin.from('player_scores').upsert(scores, { onConflict: 'player_id,week,game' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, count: scores.length })
}
