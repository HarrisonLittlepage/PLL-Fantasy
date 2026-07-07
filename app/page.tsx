'use client'
// app/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from './lib/supabase-browser'
import type {
  Profile, FantasyTeam, Player, PlayerScore, RosterSlot, RosterSnapshot,
  LeagueSettings, WeekSchedule, Matchup, GamePick, PllDoubleHeader
} from './types'
import MyTeamTab from './components/MyTeamTab'
import MatchupsTab from './components/MatchupsTab'
import StandingsTab from './components/StandingsTab'
import FreeAgentsTab from './components/FreeAgentsTab'
import LeagueTab from './components/LeagueTab'
import CommissionerTab from './components/CommissionerTab'
import WaiverTab from './components/WaiverTab'
import TransactionsTab from './components/TransactionsTab'

export default function Home() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [teams, setTeams] = useState<FantasyTeam[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [scores, setScores] = useState<PlayerScore[]>([])
  const [rosters, setRosters] = useState<RosterSlot[]>([])
  const [snapshots, setSnapshots] = useState<RosterSnapshot[]>([])
  const [settings, setSettings] = useState<LeagueSettings | null>(null)
  const [schedule, setSchedule] = useState<WeekSchedule[]>([])
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [gamePicks, setGamePicks] = useState<GamePick[]>([])
  const [pllDoubleHeaders, setPllDoubleHeaders] = useState<PllDoubleHeader[]>([])
  const [tab, setTab] = useState('matchups')
  const [initialTabSet, setInitialTabSet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingTradeCount, setPendingTradeCount] = useState(0)
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [
      { data: prof },
      { data: teamsData },
      { data: playersData },
      { data: scoresData },
      { data: rostersData },
      { data: snapshotsData },
      { data: settingsData },
      { data: scheduleData },
      { data: matchupsData },
      { data: picksData },
      { data: doubleHeadersData },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('fantasy_teams').select('*').order('id'),
      supabase.from('players').select('*').order('avg_pts', { ascending: false }),
      supabase.from('player_scores').select('*'),
      supabase.from('rosters').select('*'),
      supabase.from('roster_snapshots').select('*'),
      supabase.from('league_settings').select('*').single(),
      supabase.from('week_schedule').select('*').order('week'),
      supabase.from('matchups').select('*').order('week'),
      supabase.from('game_picks').select('*'),
      supabase.from('pll_double_headers').select('*'),
    ])

    setProfile(prof)
    setTeams(teamsData ?? [])
    setPlayers(playersData ?? [])
    setScores(scoresData ?? [])
    setRosters(rostersData ?? [])
    setSnapshots(snapshotsData ?? [])
    setSettings(settingsData)
    setSchedule(scheduleData ?? [])
    setMatchups(matchupsData ?? [])
    setGamePicks(picksData ?? [])
    setPllDoubleHeaders(doubleHeadersData ?? [])
    if (prof?.team_id) {
      const { data: pt } = await supabase.from('trades').select('id').eq('receiving_team_id', prof.team_id).eq('status', 'pending')
      setPendingTradeCount(pt?.length ?? 0)
    }
    if (prof?.is_commissioner) {
      const { data: at } = await supabase.from('trades').select('id').eq('status', 'accepted')
      setPendingApprovalCount(at?.length ?? 0)
    }
    if (prof?.team_id && !initialTabSet) { setTab('team'); setInitialTabSet(true) }
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadData() }, [loadData])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontFamily: 'sans-serif', fontSize: 14 }}>Loading league...</div>
    </div>
  )

  if (!profile || !settings) return null

  const myTeam = teams.find(t => t.id === profile.team_id)
  const isCommissioner = profile.is_commissioner

  // Determine if it's my turn in waivers (accounting for traded picks)
  const waiverOpen = settings.waiver_state === 'open'
  const order: number[] = settings.waiver_order ?? []
  const pickTrades: Array<{ from_team_id: number; to_team_id: number }> = settings.waiver_pick_trades ?? []
  let isMyWaiverTurn = false
  if (waiverOpen && profile.team_id && order.length > 0) {
    const idx = settings.waiver_current_idx ?? 0
    const baseTeamId = order[idx % order.length]
    const trade = pickTrades.find(t => t.from_team_id === baseTeamId)
    const effectiveTeamId = trade ? trade.to_team_id : baseTeamId
    isMyWaiverTurn = effectiveTeamId === profile.team_id
  }

  const navTabs = [
    { id: 'team', label: 'My Team', hidden: !profile.team_id },
    { id: 'matchups', label: 'Matchups' },
    { id: 'standings', label: 'Standings' },
    { id: 'waivers', label: 'Waivers', hidden: !profile.team_id && !isCommissioner },
    { id: 'fa', label: 'Free Agents', hidden: !profile.team_id },
    { id: 'rosters', label: 'Rosters' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'commissioner', label: 'Commissioner', commOnly: true },
  ].filter(t => !t.hidden && (!t.commOnly || isCommissioner))

  const sharedProps = {
    teams, players, scores, rosters, snapshots, settings, schedule,
    matchups, gamePicks, pllDoubleHeaders, onRefresh: loadData,
    onSignOut: handleSignOut,
  }

  return (
    <div className="app-container">
      <div className="nav">
        <div className="nav-top">
          <div className="nav-logo">PLL Fantasy<span> App</span></div>
        </div>
        <div className="nav-tabs">
          {navTabs.map(t => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' active' : ''}${t.commOnly ? ' comm' : ''}`}
              onClick={() => setTab(t.id)}
              style={{ position: 'relative' }}
            >
              {t.label}
              {t.id === 'transactions' && pendingTradeCount > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', border: '1px solid var(--navy)' }} />
              )}
              {t.id === 'commissioner' && pendingApprovalCount > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', border: '1px solid var(--navy)' }} />
              )}
              {t.id === 'waivers' && isMyWaiverTurn && (
                <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', border: '1px solid var(--navy)' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'team' && profile.team_id && <MyTeamTab {...sharedProps} myTeamId={profile.team_id} />}
      {tab === 'matchups' && <MatchupsTab {...sharedProps} myTeamId={profile.team_id} />}
      {tab === 'standings' && <StandingsTab {...sharedProps} />}
      {tab === 'waivers' && <WaiverTab {...sharedProps} myTeamId={profile.team_id} />}
      {tab === 'fa' && profile.team_id && <FreeAgentsTab {...sharedProps} myTeamId={profile.team_id} />}
      {tab === 'rosters' && <LeagueTab {...sharedProps} />}
      {tab === 'transactions' && <TransactionsTab teams={teams} players={players} myTeamId={profile.team_id} onRefresh={loadData} />}
      {tab === 'commissioner' && isCommissioner && <CommissionerTab {...sharedProps} />}
    </div>
  )
}
