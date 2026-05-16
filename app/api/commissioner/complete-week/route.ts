// app/api/commissioner/complete-week/route.ts
// Snapshots all team starting lineups for the current week, then advances to next week.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_commissioner').eq('id', user.id).single()
  if (!profile?.is_commissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  // Get current week
  const { data: settings } = await admin.from('league_settings').select('current_week').eq('id', 1).single()
  if (!settings) return NextResponse.json({ error: 'Settings not found' }, { status: 500 })

  const week = settings.current_week
  if (week >= 10) return NextResponse.json({ error: 'Season is already complete' }, { status: 400 })

  // Get all teams
  const { data: teams } = await admin.from('fantasy_teams').select('id')
  if (!teams) return NextResponse.json({ error: 'No teams found' }, { status: 500 })

  // Get all current rosters (starters only, slots 0-9)
  const { data: rosters } = await admin
    .from('rosters')
    .select('team_id, slot_index, player_id')
    .in('team_id', teams.map(t => t.id))
    .lte('slot_index', 9)

  if (!rosters) return NextResponse.json({ error: 'Could not fetch rosters' }, { status: 500 })

  // Delete any existing snapshot for this week (allows re-snapshotting if needed)
  await admin.from('roster_snapshots').delete().eq('week', week)

  // Insert snapshot rows for all starters
  const snapshots = rosters.map(r => ({
    team_id: r.team_id,
    week,
    slot_index: r.slot_index,
    player_id: r.player_id ?? null,
  }))

  if (snapshots.length > 0) {
    const { error: snapError } = await admin.from('roster_snapshots').insert(snapshots)
    if (snapError) return NextResponse.json({ error: snapError.message }, { status: 500 })
  }

  // Advance current week
  const { error: weekError } = await admin
    .from('league_settings')
    .update({ current_week: week + 1, updated_at: new Date().toISOString() })
    .eq('id', 1)

  if (weekError) return NextResponse.json({ error: weekError.message }, { status: 500 })

  return NextResponse.json({ success: true, completed_week: week, new_week: week + 1, snapshots_saved: snapshots.length })
}
