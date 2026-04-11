// app/api/commissioner/create-user/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_commissioner').eq('id', user.id).single()
  if (!profile?.is_commissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { email, password, display_name, team_id, is_commissioner } = await req.json()
  if (!email || !password || !display_name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (createError || !newUser.user) return NextResponse.json({ error: createError?.message ?? 'Failed to create user' }, { status: 500 })

  const { error: profileError } = await admin.from('profiles').update({
    display_name, team_id: team_id ?? null, is_commissioner: is_commissioner ?? false
  }).eq('id', newUser.user.id)

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  return NextResponse.json({ success: true, userId: newUser.user.id })
}
