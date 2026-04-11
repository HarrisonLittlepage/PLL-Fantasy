// app/api/commissioner/update-role/route.ts
// Commissioner-only: grant or revoke commissioner role for any user

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const browser = createSupabaseServerClient(req)
  const { data: { user } } = await browser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await browser.from('profiles').select('is_commissioner').eq('id', user.id).single()
  if (!profile?.is_commissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { user_id, is_commissioner } = await req.json()
  if (!user_id || typeof is_commissioner !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ is_commissioner })
    .eq('id', user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
