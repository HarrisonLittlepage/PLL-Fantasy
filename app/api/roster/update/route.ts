// app/api/roster/update/route.ts
// Team owners update their own roster (swap players, add free agents)

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient(req)

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Get this user's team
  const { data: profile } = await supabase.from('profiles').select('team_id').eq('id', user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  const { slot_index, player_id } = await req.json()
  if (slot_index === undefined) return NextResponse.json({ error: 'Missing slot_index' }, { status: 400 })

  // Verify this player isn't already on another team (if player_id is not null)
  if (player_id) {
    const { data: existing } = await supabase
      .from('rosters')
      .select('team_id')
      .eq('player_id', player_id)
      .neq('team_id', profile.team_id)
      .single()

    if (existing) return NextResponse.json({ error: 'Player already on another team' }, { status: 409 })
  }

  // Upsert the roster slot
  const { error } = await supabase.from('rosters').upsert({
    team_id: profile.team_id,
    slot_index,
    player_id: player_id ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'team_id,slot_index' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
