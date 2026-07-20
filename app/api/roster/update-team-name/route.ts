// app/api/roster/update-team-name/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()
  if (!profile?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  const { team_id, name } = await req.json()
  if (team_id !== profile.team_id)
    return NextResponse.json({ error: 'You can only rename your own team' }, { status: 403 })
  if (!name?.trim()) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
  if (name.trim().length > 40)
    return NextResponse.json({ error: 'Name must be 40 characters or less' }, { status: 400 })

  const { error } = await admin
    .from('fantasy_teams')
    .update({ name: name.trim() })
    .eq('id', profile.team_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
