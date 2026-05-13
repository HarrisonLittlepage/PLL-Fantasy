// app/api/roster/update-batch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, getUserFromRequest } from '../../../lib/supabase-server'

const SLOT_POSITIONS = ['A','A','M','M','D','D','FO','G','FLEX','FLEX','BN','BN','BN','BN']
const ELIGIBLE: Record<string, string[]> = {
  A:['A'], M:['M','SSDM'], D:['D','SSDM','LSM'], FO:['FO'], G:['G'],
  FLEX:['A','M','D','SSDM','FO', 'LSM'], BN:['A','M','D','SSDM','FO','G','LSM'],
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseAdminClient()

  const { data: profile } = await admin.from('profiles').select('team_id').eq('id', user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  const { slots } = await req.json()
  if (!Array.isArray(slots) || slots.length === 0)
    return NextResponse.json({ error: 'No slots provided' }, { status: 400 })

  const playerIds = slots.map((s: any) => s.player_id).filter(Boolean)
  let playerMap: Record<number, { position: string }> = {}
  if (playerIds.length > 0) {
    const { data: rows } = await admin.from('players').select('id, position').in('id', playerIds)
    playerMap = Object.fromEntries((rows ?? []).map(p => [p.id, p]))
  }

  for (const slot of slots) {
    const { slot_index, player_id } = slot
    if (slot_index < 0 || slot_index > 13)
      return NextResponse.json({ error: `Invalid slot index: ${slot_index}` }, { status: 400 })
    if (player_id) {
      const player = playerMap[player_id]
      if (!player) return NextResponse.json({ error: `Player ${player_id} not found` }, { status: 400 })
      if (!ELIGIBLE[SLOT_POSITIONS[slot_index]]?.includes(player.position))
        return NextResponse.json({ error: `${player.position} cannot play ${SLOT_POSITIONS[slot_index]}` }, { status: 400 })
      const { data: other } = await admin.from('rosters').select('team_id').eq('player_id', player_id).neq('team_id', profile.team_id).single()
      if (other) return NextResponse.json({ error: 'Player is on another team' }, { status: 409 })
    }
  }

  const { data: current } = await admin.from('rosters').select('slot_index, player_id').eq('team_id', profile.team_id)
  const rMap: Record<number, any> = {}
  for (const r of current ?? []) rMap[r.slot_index] = r.player_id
  for (const s of slots) rMap[s.slot_index] = s.player_id ?? null
  if (Object.values(rMap).filter(Boolean).length > 14)
    return NextResponse.json({ error: 'Roster cannot exceed 14 players' }, { status: 400 })

  const { error } = await admin.from('rosters').upsert(
    slots.map((s: any) => ({ team_id: profile.team_id, slot_index: s.slot_index, player_id: s.player_id ?? null, updated_at: new Date().toISOString() })),
    { onConflict: 'team_id,slot_index' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, updated: slots.length })
}
