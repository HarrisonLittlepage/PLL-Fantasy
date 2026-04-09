// app/api/roster/game-pick/route.ts
// Team owner saves their game A/B pick for a double-header week

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseBrowserClient } from '../../../lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('team_id').eq('id', user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  const { week, game_choice } = await req.json()
  if (!week || !['A', 'B'].includes(game_choice)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { error } = await supabase.from('game_picks').upsert({
    team_id: profile.team_id,
    week,
    game_choice,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'team_id,week' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
