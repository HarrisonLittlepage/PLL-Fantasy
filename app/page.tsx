'use client'
// app/page.tsx — Main entry point. Fetches all data, renders nav + tabs.

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from './lib/supabase'
import type {
  Profile, FantasyTeam, Player, PlayerScore, RosterSlot,
  LeagueSettings, WeekSchedule, Matchup, GamePick
} from './types'
import MyTeamTab from './components/MyTeamTab'
import MatchupsTab from './components/MatchupsTab'
import StandingsTab from './components/StandingsTab'
import FreeAgentsTab from './components/FreeAgentsTab'
import LeagueTab from './components/LeagueTab'
import CommissionerTab from './components/CommissionerTab'

export default function Home() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [teams, setTeams] = useState<FantasyTeam[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [scores, setScores] = useState<PlayerScore[]>([])
  const [rosters, setRosters] = useState<RosterSlot[]>([])
  const [settings, setSettings] = useState<LeagueSettings | null>(null)
  const [schedule, setSchedule] = useState<WeekSchedule[]>([])
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [gamePicks, setGamePicks] = useState<GamePick[]>([])
  const [tab, setTab] = useState('team')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [
      { data: prof },
      { data: teamsData },
      { data: playersData },
      { data: scoresData },
      { data: rostersData },
      { data: settingsData },
      { data: scheduleData },
      { data: matchupsData },
      { data: picksData },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('fantasy_teams').select('*').order('id'),
      supabase.from('players').select('*').order('avg_pts', { ascending: false }),
      supabase.from('player_scores').select('*'),
      supabase.from('rosters').select('*'),
      supabase.from('league_settings').select('*').single(),
      supabase.from('week_schedule').select('*').order('week'),
      supabase.from('matchups').select('*').order('week'),
      supabase.from('game_picks').select('*'),
    ])

    setProfile(prof)
    setTeams(teamsData ?? [])
    setPlayers(playersData ?? [])
    setScores(scoresData ?? [])
    setRosters(rostersData ?? [])
    setSettings(settingsData)
    setSchedule(scheduleData ?? [])
    setMatchups(matchupsData ?? [])
    setGamePicks(picksData ?? [])
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

  const navTabs = [
    { id: 'team', label: 'My Team', hidden: !profile.team_id },
    { id: 'matchups', label: 'Matchups' },
    { id: 'standings', label: 'Standings' },
    { id: 'fa', label: 'Free Agents', hidden: !profile.team_id },
    { id: 'league', label: 'League' },
    { id: 'commissioner', label: 'Commissioner', commOnly: true },
  ].filter(t => !t.hidden && (!t.commOnly || isCommissioner))

  const sharedProps = { teams, players, scores, rosters, settings, schedule, matchups, gamePicks, onRefresh: loadData }

  return (
    <div className="app-container">
      <div className="nav">
        <div className="nav-logo">Cage<span>League</span></div>
        <div className="nav-tabs">
          {navTabs.map(t => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' active' : ''}${t.commOnly ? ' comm' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'sans-serif' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isCommissioner ? '#a78bfa' : 'var(--green)', display: 'inline-block', marginRight: 6 }} />
            {myTeam ? `${myTeam.icon} ${myTeam.name}` : profile.display_name}
            {isCommissioner && <span style={{ marginLeft: 6, fontSize: 10, color: '#a78bfa' }}>(Comm)</span>}
          </div>
          <button className="btn btn-sm btn-outline" onClick={handleSignOut}>Sign out</button>
        </div>
      </div>

      {tab === 'team' && profile.team_id && <MyTeamTab {...sharedProps} myTeamId={profile.team_id} />}
      {tab === 'matchups' && <MatchupsTab {...sharedProps} myTeamId={profile.team_id} />}
      {tab === 'standings' && <StandingsTab {...sharedProps} />}
      {tab === 'fa' && profile.team_id && <FreeAgentsTab {...sharedProps} myTeamId={profile.team_id} />}
      {tab === 'league' && <LeagueTab {...sharedProps} />}
      {tab === 'commissioner' && isCommissioner && <CommissionerTab {...sharedProps} />}
    </div>
  )
}
