// app/api/roster/update-team-name/route.ts
// Team owners can rename only their own team

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient(req)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  if (!profile?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  const { team_id, name } = await req.json()

  // Verify the team_id in the request matches the user's actual team
  if (team_id !== profile.team_id) {
    return NextResponse.json({ error: 'You can only rename your own team' }, { status: 403 })
  }

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: 'Team name cannot be empty' }, { status: 400 })
  }

  if (name.trim().length > 40) {
    return NextResponse.json({ error: 'Team name must be 40 characters or less' }, { status: 400 })
  }

  const { error } = await supabase
    .from('fantasy_teams')
    .update({ name: name.trim() })
    .eq('id', profile.team_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
