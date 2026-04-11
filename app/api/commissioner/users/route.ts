// app/api/commissioner/users/route.ts
// Commissioner-only: fetch all profiles to display in the user management panel

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseBrowserClient } from '../../../lib/supabase'

export async function GET(req: NextRequest) {
  const browser = createSupabaseBrowserClient()
  const { data: { user } } = await browser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await browser.from('profiles').select('is_commissioner').eq('id', user.id).single()
  if (!profile?.is_commissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = createSupabaseAdminClient()
  const { data: users, error } = await admin
    .from('profiles')
    .select('id, email, display_name, is_commissioner, team_id')
    .order('display_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users })
}
