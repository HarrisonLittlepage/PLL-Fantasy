// app/api/commissioner/complete-week/route.ts
// Snapshots all team starting lineups for the current week, then advances to next week.
// Also recalculates avg_pts for all players based on weeks they actually played.

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

  // Get all current rosters (starters + bench)
  const { data: rosters } = await admin
    .from('rosters')
    .select('team_id, slot_index, player_id')
    .in('team_id', teams.map(t => t.id))
    .not('player_id', 'is', null)

  if (!rosters) return NextResponse.json({ error: 'Could not fetch rosters' }, { status: 500 })

  // Delete any existing snapshot for this week (allows re-snapshotting if needed)
  await admin.from('roster_snapshots').delete().eq('week', week)

  // Insert snapshot rows for all players
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

  // ── Recalculate avg_pts for all players ──────────────────────────────────
  // Fetch all scores, players, bye weeks, and double headers
  const [
    { data: allScores },
    { data: allPlayers },
    { data: byeWeeks },
    { data: doubleHeaders },
  ] = await Promise.all([
    admin.from('player_scores').select('player_id, week, game, points'),
    admin.from('players').select('id, pll_team'),
    admin.from('pll_bye_weeks').select('week, pll_team'),
    admin.from('pll_double_headers').select('week, pll_team'),
  ])

  if (allScores && allPlayers) {
    // Build a map of bye weeks per PLL team
    const byeMap: Record<string, Set<number>> = {}
    for (const b of byeWeeks ?? []) {
      if (!byeMap[b.pll_team]) byeMap[b.pll_team] = new Set()
      byeMap[b.pll_team].add(b.week)
    }

    // Build a set of double-header weeks per PLL team
    const dhMap: Record<string, Set<number>> = {}
    for (const dh of doubleHeaders ?? []) {
      if (!dhMap[dh.pll_team]) dhMap[dh.pll_team] = new Set()
      dhMap[dh.pll_team].add(dh.week)
    }

    // For each player, calculate avg across weeks they actually played
    const updates: Array<{ id: number; avg_pts: number }> = []

    for (const player of allPlayers) {
      const pllTeam = player.pll_team
      const byeWeeksForTeam = byeMap[pllTeam] ?? new Set()
      const dhWeeksForTeam = dhMap[pllTeam] ?? new Set()

      // Get all score records for this player up to current week
      const playerScores = allScores.filter(s => s.player_id === player.id && s.week <= week)

      // Group by week
      const scoresByWeek: Record<number, { A?: number; B?: number }> = {}
      for (const s of playerScores) {
        if (!scoresByWeek[s.week]) scoresByWeek[s.week] = {}
        scoresByWeek[s.week][s.game as 'A' | 'B'] = Number(s.points)
      }

      // Get weeks where the team actually played (not on bye)
      const weeksPlayed = Object.keys(scoresByWeek)
        .map(Number)
        .filter(w => !byeWeeksForTeam.has(w))

      if (weeksPlayed.length === 0) continue

      // Calculate total points across played weeks
      let totalPts = 0
      for (const w of weeksPlayed) {
        const wkScores = scoresByWeek[w]
        if (dhWeeksForTeam.has(w) && wkScores.B !== undefined) {
          // Double header — average game A and B
          totalPts += ((wkScores.A ?? 0) + wkScores.B) / 2
        } else {
          totalPts += wkScores.A ?? 0
        }
      }

      const avg = Math.round((totalPts / weeksPlayed.length) * 100) / 100
      updates.push({ id: player.id, avg_pts: avg })
    }

    // Batch update avg_pts
    for (const update of updates) {
      await admin.from('players').update({ avg_pts: update.avg_pts }).eq('id', update.id)
    }
  }

  // Advance current week
  const { error: weekError } = await admin
    .from('league_settings')
    .update({ current_week: week + 1, updated_at: new Date().toISOString() })
    .eq('id', 1)

  if (weekError) return NextResponse.json({ error: weekError.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    completed_week: week,
    new_week: week + 1,
    snapshots_saved: snapshots.length,
    avg_pts_updated: true,
  })
}
