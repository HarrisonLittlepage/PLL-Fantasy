'use client'
// app/components/PlayoffBracket.tsx

import type { FantasyTeam, Player, PlayerScore, RosterSlot, RosterSnapshot, LeagueSettings, WeekSchedule, Matchup, PllDoubleHeader } from '../types'
import { getFullStandings, getTeamWeekScore } from '../lib/scoring'

interface Props {
  teams: FantasyTeam[]
  players: Player[]
  scores: PlayerScore[]
  rosters: RosterSlot[]
  snapshots: RosterSnapshot[]
  settings: LeagueSettings
  schedule: WeekSchedule[]
  matchups: Matchup[]
  pllDoubleHeaders: PllDoubleHeader[]
}

export default function PlayoffBracket({ teams, players, scores, rosters, snapshots, settings, schedule, matchups, pllDoubleHeaders }: Props) {
  const week = settings.current_week

  const standings = getFullStandings(teams, rosters, scores, players, schedule, matchups, pllDoubleHeaders, week, snapshots)
  const seedOf = (teamId: number | undefined) => teamId ? standings.findIndex(s => s.team.id === teamId) + 1 : null

  const week9Locked = matchups.some(m => m.week === 9 && m.matchup_type === 'semifinal')
  const week10Locked = matchups.some(m => m.week === 10 && m.matchup_type === 'championship')

  const semi1 = matchups.find(m => m.week === 9 && m.matchup_type === 'semifinal' && m.seed_label === '1 vs 4')
  const semi2 = matchups.find(m => m.week === 9 && m.matchup_type === 'semifinal' && m.seed_label === '2 vs 3')
  const toiletBowl1 = matchups.find(m => m.week === 9 && m.matchup_type === 'toilet_bowl')

  const semi1Teams = week9Locked && semi1
    ? { home: teams.find(t => t.id === semi1.home_team_id)!, away: teams.find(t => t.id === semi1.away_team_id)! }
    : { home: standings[0]?.team, away: standings[3]?.team }
  const semi2Teams = week9Locked && semi2
    ? { home: teams.find(t => t.id === semi2.home_team_id)!, away: teams.find(t => t.id === semi2.away_team_id)! }
    : { home: standings[1]?.team, away: standings[2]?.team }
  const toiletTeams = week9Locked && toiletBowl1
    ? { home: teams.find(t => t.id === toiletBowl1.home_team_id)!, away: teams.find(t => t.id === toiletBowl1.away_team_id)! }
    : { home: standings[4]?.team, away: standings[5]?.team }

  const showWeek9Scores = week9Locked && week >= 9
  const semi1Home = semi1Teams.home ? getTeamWeekScore(semi1Teams.home.id, 9, rosters, scores, players, pllDoubleHeaders, week, snapshots) : 0
  const semi1Away = semi1Teams.away ? getTeamWeekScore(semi1Teams.away.id, 9, rosters, scores, players, pllDoubleHeaders, week, snapshots) : 0
  const semi2Home = semi2Teams.home ? getTeamWeekScore(semi2Teams.home.id, 9, rosters, scores, players, pllDoubleHeaders, week, snapshots) : 0
  const semi2Away = semi2Teams.away ? getTeamWeekScore(semi2Teams.away.id, 9, rosters, scores, players, pllDoubleHeaders, week, snapshots) : 0

  const championship = matchups.find(m => m.week === 10 && m.matchup_type === 'championship')
  const thirdPlace = matchups.find(m => m.week === 10 && m.matchup_type === 'third_place')

  const champHome = championship ? teams.find(t => t.id === championship.home_team_id) : null
  const champAway = championship ? teams.find(t => t.id === championship.away_team_id) : null
  const thirdHome = thirdPlace ? teams.find(t => t.id === thirdPlace.home_team_id) : null
  const thirdAway = thirdPlace ? teams.find(t => t.id === thirdPlace.away_team_id) : null

  const showWeek10Scores = week10Locked && week >= 10
  const champHomeScore = champHome ? getTeamWeekScore(champHome.id, 10, rosters, scores, players, pllDoubleHeaders, week, snapshots) : 0
  const champAwayScore = champAway ? getTeamWeekScore(champAway.id, 10, rosters, scores, players, pllDoubleHeaders, week, snapshots) : 0
  const thirdHomeScore = thirdHome ? getTeamWeekScore(thirdHome.id, 10, rosters, scores, players, pllDoubleHeaders, week, snapshots) : 0
  const thirdAwayScore = thirdAway ? getTeamWeekScore(thirdAway.id, 10, rosters, scores, players, pllDoubleHeaders, week, snapshots) : 0

  const toiletHomeTotal = toiletTeams.home
    ? getTeamWeekScore(toiletTeams.home.id, 9, rosters, scores, players, pllDoubleHeaders, week, snapshots) +
      (week10Locked ? getTeamWeekScore(toiletTeams.home.id, 10, rosters, scores, players, pllDoubleHeaders, week, snapshots) : 0)
    : 0
  const toiletAwayTotal = toiletTeams.away
    ? getTeamWeekScore(toiletTeams.away.id, 9, rosters, scores, players, pllDoubleHeaders, week, snapshots) +
      (week10Locked ? getTeamWeekScore(toiletTeams.away.id, 10, rosters, scores, players, pllDoubleHeaders, week, snapshots) : 0)
    : 0
  const toiletBowlComplete = week10Locked && week >= 11

  const teamBox = (
    team: FantasyTeam | null | undefined,
    seed: number | null,
    score: number | null,
    showScore: boolean,
    isWinner: boolean,
    isLoser: boolean,
    borderSide?: 'top' | 'bottom'
  ) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px', minHeight: 36,
      background: isWinner ? '#1a3a2a' : 'var(--navy-light)',
      border: `1px solid ${isWinner ? 'var(--green)' : 'var(--navy-border)'}`,
      borderRadius: borderSide === 'top' ? '6px 6px 0 0' : borderSide === 'bottom' ? '0 0 6px 6px' : 6,
      opacity: isLoser ? 0.55 : 1,
    }}>
      {seed != null && (
        <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', minWidth: 12 }}>{seed}.</span>
      )}
      <span style={{ flex: 1, fontSize: 12, color: team ? 'var(--text)' : 'var(--muted)', fontFamily: 'sans-serif', fontWeight: isWinner ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {team?.name ?? 'TBD'}
      </span>
      {showScore && team && <span style={{ fontSize: 12, fontWeight: 700, color: isWinner ? 'var(--green)' : 'var(--gold)', flexShrink: 0 }}>{Math.round(score! * 100) / 100}</span>}
    </div>
  )

  // A matchup = two stacked boxes joined with a connector bracket on the right
  const matchupPair = (
    homeTeam: FantasyTeam | null | undefined, homeSeed: number | null, homeScore: number,
    awayTeam: FantasyTeam | null | undefined, awaySeed: number | null, awayScore: number,
    showScores: boolean
  ) => {
    const homeWin = showScores && homeScore > awayScore
    const awayWin = showScores && awayScore > homeScore
    return (
      <div style={{ position: 'relative' }}>
        {teamBox(homeTeam, homeSeed, homeScore, showScores, homeWin, awayWin, 'top')}
        <div style={{ height: 1, background: 'var(--navy-border)' }} />
        {teamBox(awayTeam, awaySeed, awayScore, showScores, awayWin, homeWin, 'bottom')}
      </div>
    )
  }

  return (
    <div>
      {/* Championship bracket */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr', alignItems: 'center', gap: 0 }}>
          {/* Semifinals column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {matchupPair(semi1Teams.home, seedOf(semi1Teams.home?.id), semi1Home, semi1Teams.away, seedOf(semi1Teams.away?.id), semi1Away, showWeek9Scores)}
            {matchupPair(semi2Teams.home, seedOf(semi2Teams.home?.id), semi2Home, semi2Teams.away, seedOf(semi2Teams.away?.id), semi2Away, showWeek9Scores)}
          </div>

          {/* Connector lines */}
          <div style={{ position: 'relative', height: '100%', alignSelf: 'stretch' }}>
            <svg width="24" height="100%" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
              <line x1="0" y1="23%" x2="12" y2="23%" stroke="var(--navy-border)" strokeWidth="1" />
              <line x1="0" y1="77%" x2="12" y2="77%" stroke="var(--navy-border)" strokeWidth="1" />
              <line x1="12" y1="23%" x2="12" y2="77%" stroke="var(--navy-border)" strokeWidth="1" />
              <line x1="12" y1="50%" x2="24" y2="50%" stroke="var(--navy-border)" strokeWidth="1" />
            </svg>
          </div>

          {/* Championship column */}
          <div>
            <div style={{ fontSize: 9, color: 'var(--gold)', fontFamily: 'sans-serif', textAlign: 'center', marginBottom: 6, letterSpacing: '1px', textTransform: 'uppercase' }}>
              🏆 Championship
            </div>
            {championship
              ? matchupPair(champHome, null, champHomeScore, champAway, null, champAwayScore, showWeek10Scores)
              : matchupPair(null, null, 0, null, null, 0, false)}
          </div>
        </div>
      </div>

      {/* Third place — aligned under the championship column only */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr', gap: 0, marginBottom: 24 }}>
        <div />
        <div />
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>3rd Place</div>
          {thirdPlace
            ? matchupPair(thirdHome, null, thirdHomeScore, thirdAway, null, thirdAwayScore, showWeek10Scores)
            : matchupPair(null, null, 0, null, null, 0, false)}
        </div>
      </div>

      {/* Toilet Bowl */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
          🚽 Toilet Bowl — Combined Score, Weeks 9 &amp; 10
        </div>
        {matchupPair(toiletTeams.home, seedOf(toiletTeams.home?.id), toiletHomeTotal, toiletTeams.away, seedOf(toiletTeams.away?.id), toiletAwayTotal, week9Locked)}
        {toiletBowlComplete && (
          <div style={{ fontSize: 11, color: '#e06060', fontFamily: 'sans-serif', marginTop: 8, textAlign: 'center' }}>
            {(toiletHomeTotal < toiletAwayTotal ? toiletTeams.home?.name : toiletTeams.away?.name)} finishes last 🚽
          </div>
        )}
      </div>
    </div>
  )
}
