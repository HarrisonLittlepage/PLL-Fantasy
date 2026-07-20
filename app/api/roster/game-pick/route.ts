// app/api/roster/game-pick/route.ts
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

  const { week, game_choice } = await req.json()
  if (!week || !['A', 'B'].includes(game_choice))
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { error } = await admin
    .from('game_picks')
    .upsert(
      { team_id: profile.team_id, week, game_choice, updated_at: new Date().toISOString() },
      { onConflict: 'team_id,week' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
