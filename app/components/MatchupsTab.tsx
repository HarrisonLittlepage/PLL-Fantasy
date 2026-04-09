'use client'
// app/components/MatchupsTab.tsx

import { useState } from 'react'
import type { FantasyTeam, Player, PlayerScore, RosterSlot, LeagueSettings, WeekSchedule, Matchup, GamePick } from '../types'
import { getTeamWeekScore, getPlayoffSeeds } from '../lib/scoring'

interface Props {
  myTeamId: number | null
  teams: FantasyTeam[]
  players: Player[]
  scores: PlayerScore[]
  rosters: RosterSlot[]
  settings: LeagueSettings
  schedule: WeekSchedule[]
  matchups: Matchup[]
  gamePicks: GamePick[]
  onRefresh: () => void
}

export default function MatchupsTab({ myTeamId, teams, scores, rosters, settings, schedule, matchups, gamePicks }: Props) {
  const [viewWeek, setViewWeek] = useState(settings.current_week)
  const byeMode = settings.bye_scoring_mode
  const currentWeek = settings.current_week

  const wkData = schedule.find(s => s.week === viewWeek)
  const isPlayoff = wkData?.week_type === 'playoffs'
  const isPast = viewWeek < currentWeek

  const seeds = getPlayoffSeeds(teams, rosters, scores, schedule, matchups, byeMode, gamePicks)

  let weekMatchups: Array<{ homeId: number; awayId: number; label?: string }> = []

  if (isPlayoff) {
    if (viewWeek === 11) {
      weekMatchups = [
        { homeId: seeds[0].team.id, awayId: seeds[3].team.id, label: 'Semifinal — 1 vs 4' },
        { homeId: seeds[1].team.id, awayId: seeds[2].team.id, label: 'Semifinal — 2 vs 3' },
      ]
    } else if (viewWeek === 12) {
      weekMatchups = [{ homeId: seeds[0].team.id, awayId: seeds[1].team.id, label: 'Championship' }]
    }
  } else {
    weekMatchups = matchups
      .filter(m => m.week === viewWeek)
      .map(m => ({ homeId: m.home_team_id, awayId: m.away_team_id }))
  }

  function teamScore(teamId: number) {
    const isDouble = wkData?.double_team_id === teamId
    const pick = gamePicks.find(gp => gp.team_id === teamId && gp.week === viewWeek)?.game_choice ?? 'A'
    return getTeamWeekScore(teamId, viewWeek, rosters, scores, isDouble, byeMode, pick)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginRight: 4 }}>Week:</span>
        {Array.from({ length: 12 }, (_, i) => {
          const wk = i + 1
          const isPlayoffWk = wk >= 11
          return (
            <button
              key={wk}
              onClick={() => setViewWeek(wk)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 5, fontSize: 11, fontFamily: 'sans-serif',
                cursor: 'pointer', border: viewWeek === wk ? 'none' : '1px solid var(--navy-border)',
                background: viewWeek === wk ? (isPlayoffWk ? 'var(--gold-dark)' : 'var(--gold)') : 'transparent',
                color: viewWeek === wk ? '#0a0f1a' : isPlayoffWk ? 'var(--gold)' : 'var(--muted)',
                fontWeight: viewWeek === wk ? 700 : 400,
              }}
            >
              {wk < 11 ? wk : wk === 11 ? 'SF' : '🏆'}
            </button>
          )
        })}
      </div>

      {isPlayoff && (
        <div className="pill pill-playoff" style={{ marginBottom: 12, fontSize: 11 }}>{wkData?.playoff_label ?? 'Playoffs'}</div>
      )}

      {wkData?.bye_team_id && !isPlayoff && (
        <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, fontFamily: 'sans-serif', color: 'var(--muted)' }}>
          <span>This week:</span>
          <span style={{ fontSize: 10, padding: '1px 6px', background: '#1a2030', border: '1px solid var(--navy-border)', borderRadius: 3 }}>
            {teams.find(t => t.id === wkData.bye_team_id)?.owner_name} — BYE
          </span>
          {wkData.double_team_id && (
            <span style={{ fontSize: 10, padding: '1px 6px', background: '#2a1a3a', border: '1px solid #4a2060', borderRadius: 3, color: '#b06ade' }}>
              {teams.find(t => t.id === wkData.double_team_id)?.owner_name} — Double-header
            </span>
          )}
        </div>
      )}

      {weekMatchups.map(({ homeId, awayId, label }, i) => {
        const homeTeam = teams.find(t => t.id === homeId)
        const awayTeam = teams.find(t => t.id === awayId)
        if (!homeTeam || !awayTeam) return null
        const homeScore = teamScore(homeId)
        const awayScore = teamScore(awayId)
        const homeWin = isPast && homeScore > awayScore
        const awayWin = isPast && awayScore > homeScore
        const highlight = homeId === myTeamId || awayId === myTeamId

        return (
          <div key={i} className={`matchup-card${isPlayoff ? ' playoff' : ''}`} style={highlight ? { border: '1px solid var(--gold-dark)' } : {}}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, marginBottom: 3 }}>{homeTeam.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', color: homeWin ? 'var(--green)' : 'var(--text)' }}>{homeTeam.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{homeTeam.owner_name}</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'sans-serif', color: homeWin ? 'var(--green)' : awayWin ? 'var(--muted)' : 'var(--gold)' }}>{homeScore}</div>
              {homeWin && <span className="pill pill-win">W</span>}
              {awayWin && <span className="pill pill-loss">L</span>}
              {viewWeek === currentWeek && !isPast && <span className="pill pill-live">Live</span>}
            </div>
            <div style={{ textAlign: 'center', fontFamily: 'sans-serif', fontSize: 11, color: 'var(--muted)' }}>
              <div>{label ?? 'vs'}</div>
              {isPlayoff && seeds.length >= 4 && (
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--gold)' }}>
                  #{seeds.findIndex(s => s.team.id === homeId) + 1} vs #{seeds.findIndex(s => s.team.id === awayId) + 1}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, marginBottom: 3 }}>{awayTeam.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', color: awayWin ? 'var(--green)' : 'var(--text)' }}>{awayTeam.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{awayTeam.owner_name}</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'sans-serif', color: awayWin ? 'var(--green)' : homeWin ? 'var(--muted)' : 'var(--gold)' }}>{awayScore}</div>
              {awayWin && <span className="pill pill-win">W</span>}
              {homeWin && <span className="pill pill-loss">L</span>}
            </div>
          </div>
        )
      })}

      {weekMatchups.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'sans-serif', padding: '20px 0' }}>
          No matchups scheduled for this week yet.
        </div>
      )}
    </div>
  )
}
