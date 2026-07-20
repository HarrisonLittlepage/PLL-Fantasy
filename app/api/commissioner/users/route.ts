// app/api/commissioner/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

export async function GET(req: NextRequest) {
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

  const { data: users, error } = await admin
    .from('profiles')
    .select('id, email, display_name, is_commissioner, team_id')
    .order('display_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users })
}
