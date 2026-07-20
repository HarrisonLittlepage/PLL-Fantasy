// app/api/commissioner/update-role/route.ts
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

  const { user_id, is_commissioner } = await req.json()
  if (!user_id || typeof is_commissioner !== 'boolean')
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { error } = await admin.from('profiles').update({ is_commissioner }).eq('id', user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
