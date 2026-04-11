// app/api/commissioner/create-user/route.ts
// Commissioner-only: create a new user account and link them to a fantasy team.
// Uses the service role key so it can bypass RLS and create auth users.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseBrowserClient } from '../../../lib/supabase'

export async function POST(req: NextRequest) {
  // 1. Verify the caller is a logged-in commissioner
  const browser = createSupabaseBrowserClient()
  const { data: { user } } = await browser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await browser.from('profiles').select('is_commissioner').eq('id', user.id).single()
  if (!profile?.is_commissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  // 2. Parse request body
  const { email, password, display_name, team_id, is_commissioner } = await req.json()
  if (!email || !password || !display_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 3. Create the auth user using admin client
  const admin = createSupabaseAdminClient()
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email confirmation
  })

  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message ?? 'Failed to create user' }, { status: 500 })
  }

  // 4. Update their profile with display name, team assignment, and role
  const { error: profileError } = await admin
    .from('profiles')
    .update({ display_name, team_id: team_id ?? null, is_commissioner: is_commissioner ?? false })
    .eq('id', newUser.user.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, userId: newUser.user.id })
}
