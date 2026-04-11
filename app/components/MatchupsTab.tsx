'use client'
// app/components/MatchupsTab.tsx

import { useState } from 'react'
import type { FantasyTeam, Player, PlayerScore, RosterSlot, LeagueSettings, WeekSchedule, Matchup, GamePick } from '../types'
import { SLOT_LABELS } from '../types'
import { getTeamWeekScore, getPlayerWeekScore, getPlayoffSeeds } from '../lib/scoring'

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

interface ModalMatchup {
  homeId: number
  awayId: number
  week: number
  label?: string
}

export default function MatchupsTab({ myTeamId, teams, players, scores, rosters, settings, schedule, matchups, gamePicks }: Props) {
  const [viewWeek, setViewWeek] = useState(settings.current_week)
  const [modal, setModal] = useState<ModalMatchup | null>(null)
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

  function teamScore(teamId: number, wk = viewWeek) {
    const wkInfo = schedule.find(s => s.week === wk)
    const isDouble = wkInfo?.double_team_id === teamId
    const pick = gamePicks.find(gp => gp.team_id === teamId && gp.week === wk)?.game_choice ?? 'A'
    return getTeamWeekScore(teamId, wk, rosters, scores, isDouble, byeMode, pick)
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
          <div
            key={i}
            className={`matchup-card${isPlayoff ? ' playoff' : ''}`}
            style={{ ...(highlight ? { border: '1px solid var(--gold-dark)' } : {}), cursor: 'pointer' }}
            onClick={() => setModal({ homeId, awayId, week: viewWeek, label })}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', color: homeWin ? 'var(--green)' : 'var(--text)' }}>{homeTeam.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{homeTeam.owner_name}</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'sans-serif', color: homeWin ? 'var(--green)' : awayWin ? 'var(--muted)' : 'var(--gold)' }}>{homeScore}</div>
              {homeWin && <span className="pill pill-win">W</span>}
              {awayWin && <span className="pill pill-loss">L</span>}
            </div>
            <div style={{ textAlign: 'center', fontFamily: 'sans-serif', fontSize: 11, color: 'var(--muted)' }}>
              <div>{label ?? 'vs'}</div>
              {isPlayoff && seeds.length >= 4 && (
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--gold)' }}>
                  #{seeds.findIndex(s => s.team.id === homeId) + 1} vs #{seeds.findIndex(s => s.team.id === awayId) + 1}
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--muted)' }}>tap for box score</div>
            </div>
            <div style={{ textAlign: 'center' }}>
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

      {modal && (
        <BoxScoreModal
          modal={modal}
          teams={teams}
          players={players}
          scores={scores}
          rosters={rosters}
          schedule={schedule}
          gamePicks={gamePicks}
          byeMode={byeMode}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── BOX SCORE MODAL ───────────────────────────────────────────────────────────
function BoxScoreModal({ modal, teams, players, scores, rosters, schedule, gamePicks, byeMode, onClose }: {
  modal: ModalMatchup
  teams: FantasyTeam[]
  players: Player[]
  scores: PlayerScore[]
  rosters: RosterSlot[]
  schedule: WeekSchedule[]
  gamePicks: GamePick[]
  byeMode: string
  onClose: () => void
}) {
  const { homeId, awayId, week, label } = modal
  const homeTeam = teams.find(t => t.id === homeId)!
  const awayTeam = teams.find(t => t.id === awayId)!
  const wkData = schedule.find(s => s.week === week)

  function getRosterWithScores(teamId: number) {
    const teamRoster = rosters
      .filter(r => r.team_id === teamId)
      .sort((a, b) => a.slot_index - b.slot_index)

    return teamRoster.map(slot => {
      const player = slot.player_id ? players.find(p => p.id === slot.player_id) ?? null : null
      const isDouble = wkData?.double_team_id === teamId
      const pick = gamePicks.find(gp => gp.team_id === teamId && gp.week === week)?.game_choice ?? 'A'
      const pts = player ? getPlayerWeekScore(player.id, week, scores, isDouble, byeMode as any, pick) : null
      return { slot, player, pts }
    })
  }

  const homeRoster = getRosterWithScores(homeId)
  const awayRoster = getRosterWithScores(awayId)

  const homeTotal = homeRoster.slice(0, 10).reduce((s, r) => s + (r.pts ?? 0), 0)
  const awayTotal = awayRoster.slice(0, 10).reduce((s, r) => s + (r.pts ?? 0), 0)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 200, padding: '40px 16px', overflowY: 'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--navy-card)', border: '1px solid var(--navy-border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 700 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'sans-serif' }}>Week {week}{label ? ` · ${label}` : ''}</div>
          <button className="btn btn-sm btn-outline" onClick={onClose}>✕ Close</button>
        </div>

        {/* Score summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, marginBottom: 24, padding: '16px', background: 'var(--navy-light)', borderRadius: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'sans-serif', color: homeTotal > awayTotal ? 'var(--green)' : 'var(--text)' }}>{homeTeam.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{homeTeam.owner_name}</div>
            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'sans-serif', color: homeTotal > awayTotal ? 'var(--green)' : 'var(--gold)' }}>{homeTotal}</div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>vs</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'sans-serif', color: awayTotal > homeTotal ? 'var(--green)' : 'var(--text)' }}>{awayTeam.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{awayTeam.owner_name}</div>
            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'sans-serif', color: awayTotal > homeTotal ? 'var(--green)' : 'var(--gold)' }}>{awayTotal}</div>
          </div>
        </div>

        {/* Side-by-side rosters */}
        <div className="grid2" style={{ gap: 16 }}>
          {[{ team: homeTeam, roster: homeRoster }, { team: awayTeam, roster: awayRoster }].map(({ team, roster }) => (
            <div key={team.id}>
              <div className="section-title">{team.name}</div>
              {roster.map(({ slot, player, pts }, i) => (
                <div key={slot.slot_index} style={{
                  display: 'grid', gridTemplateColumns: '50px minmax(0,1fr) 30px',
                  gap: 6, padding: '5px 8px', fontSize: 12, fontFamily: 'sans-serif',
                  borderBottom: '1px solid var(--navy-border)',
                  background: slot.slot_index >= 10 ? 'transparent' : undefined,
                  opacity: slot.slot_index >= 10 ? 0.5 : 1,
                }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'flex', alignItems: 'center' }}>
                    {SLOT_LABELS[slot.slot_index]}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {player && <span className={`pos pos-${player.position}`}>{player.position}</span>}
                    <span style={{ color: player ? 'var(--text)' : 'var(--muted)' }}>{player?.name ?? '—'}</span>
                  </div>
                  <div style={{ textAlign: 'right', color: slot.slot_index < 10 ? 'var(--gold)' : 'var(--muted)', fontWeight: slot.slot_index < 10 ? 600 : 400 }}>
                    {pts != null && player ? pts : ''}
                  </div>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '50px minmax(0,1fr) 30px', gap: 6, padding: '8px 8px 0', fontFamily: 'sans-serif' }}>
                <div />
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total</div>
                <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
                  {roster.slice(0, 10).reduce((s, r) => s + (r.pts ?? 0), 0)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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
