// app/api/commissioner/scores/route.ts
// Commissioner-only: enter or update player scores for a week

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../lib/supabase'

export async function POST(req: NextRequest) {
  const browser = createSupabaseServerClient(req)
  const { data: { user } } = await browser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await browser.from('profiles').select('is_commissioner').eq('id', user.id).single()
  if (!profile?.is_commissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  // Body: { scores: Array<{ player_id, week, game, points }> }
  const { scores } = await req.json()
  if (!Array.isArray(scores)) return NextResponse.json({ error: 'scores must be an array' }, { status: 400 })

  const admin = createSupabaseAdminClient()

  // Upsert all scores (update if exists, insert if not)
  const { error } = await admin.from('player_scores').upsert(scores, {
    onConflict: 'player_id,week,game',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, count: scores.length })
}
