// app/api/commissioner/settings/route.ts
// Commissioner-only: update league settings (current week, bye scoring mode)

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const browser = createSupabaseServerClient(req)
  const { data: { user } } = await browser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await browser.from('profiles').select('is_commissioner').eq('id', user.id).single()
  if (!profile?.is_commissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const admin = createSupabaseAdminClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.current_week !== undefined) updates.current_week = body.current_week
  if (body.bye_scoring_mode !== undefined) updates.bye_scoring_mode = body.bye_scoring_mode

  const { error } = await admin.from('league_settings').update(updates).eq('id', 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
