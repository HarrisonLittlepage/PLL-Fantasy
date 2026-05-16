'use client'
// app/components/MatchupsTab.tsx

import { useState } from 'react'
import type { FantasyTeam, Player, PlayerScore, RosterSlot, RosterSnapshot, LeagueSettings, WeekSchedule, Matchup, GamePick, PllDoubleHeader } from '../types'
import { SLOT_LABELS } from '../types'
import { getTeamWeekScore, getPlayerWeekScore, getPlayoffSeeds } from '../lib/scoring'

interface Props {
  myTeamId: number | null
  teams: FantasyTeam[]
  players: Player[]
  scores: PlayerScore[]
  rosters: RosterSlot[]
  snapshots: RosterSnapshot[]
  settings: LeagueSettings
  schedule: WeekSchedule[]
  matchups: Matchup[]
  gamePicks: GamePick[]
  pllDoubleHeaders: PllDoubleHeader[]
  onRefresh: () => void
}

interface ModalMatchup {
  homeId: number
  awayId: number
  week: number
  label?: string
}

export default function MatchupsTab({ myTeamId, teams, players, scores, rosters, snapshots, settings, schedule, matchups, gamePicks, pllDoubleHeaders }: Props) {
  const [viewWeek, setViewWeek] = useState(settings.current_week)
  const [modal, setModal] = useState<ModalMatchup | null>(null)
  const currentWeek = settings.current_week

  const wkData = schedule.find(s => s.week === viewWeek)
  const isPlayoff = wkData?.week_type === 'playoffs'
  const isPast = viewWeek < currentWeek

  const seeds = getPlayoffSeeds(teams, rosters, scores, players, schedule, matchups, pllDoubleHeaders, currentWeek, snapshots)

  let weekMatchups: Array<{ homeId: number; awayId: number; label?: string }> = []
  if (isPlayoff) {
    if (viewWeek === 9) {
      weekMatchups = [
        { homeId: seeds[0].team.id, awayId: seeds[3].team.id, label: 'Semifinal — 1 vs 4' },
        { homeId: seeds[1].team.id, awayId: seeds[2].team.id, label: 'Semifinal — 2 vs 3' },
      ]
    } else if (viewWeek === 10) {
      weekMatchups = [{ homeId: seeds[0].team.id, awayId: seeds[1].team.id, label: 'Championship' }]
    }
  } else {
    weekMatchups = matchups.filter(m => m.week === viewWeek).map(m => ({ homeId: m.home_team_id, awayId: m.away_team_id }))
  }

  function teamScore(teamId: number, wk = viewWeek) {
    return getTeamWeekScore(teamId, wk, rosters, scores, players, pllDoubleHeaders, currentWeek, snapshots)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginRight: 4 }}>Week:</span>
        {Array.from({ length: 10 }, (_, i) => {
          const wk = i + 1
          const isPlayoffWk = wk >= 9
          return (
            <button key={wk} onClick={() => setViewWeek(wk)} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 5, fontSize: 11, fontFamily: 'sans-serif',
              cursor: 'pointer', border: viewWeek === wk ? 'none' : '1px solid var(--navy-border)',
              background: viewWeek === wk ? (isPlayoffWk ? 'var(--gold-dark)' : 'var(--gold)') : 'transparent',
              color: viewWeek === wk ? '#0a0f1a' : isPlayoffWk ? 'var(--gold)' : 'var(--muted)',
              fontWeight: viewWeek === wk ? 700 : 400,
            }}>
              {wk < 9 ? wk : wk === 9 ? 'SF' : '🏆'}
            </button>
          )
        })}
      </div>

      {isPlayoff && <div className="pill pill-playoff" style={{ marginBottom: 12, fontSize: 11 }}>{wkData?.playoff_label ?? 'Playoffs'}</div>}

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
          <div key={i} className={`matchup-card${isPlayoff ? ' playoff' : ''}`}
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
        <BoxScoreModal modal={modal} teams={teams} players={players} scores={scores}
          rosters={rosters} snapshots={snapshots} schedule={schedule}
          pllDoubleHeaders={pllDoubleHeaders} currentWeek={currentWeek}
          onClose={() => setModal(null)} />
      )}
    </div>
  )
}

function BoxScoreModal({ modal, teams, players, scores, rosters, snapshots, schedule, pllDoubleHeaders, currentWeek, onClose }: {
  modal: ModalMatchup; teams: FantasyTeam[]; players: Player[]; scores: PlayerScore[]
  rosters: RosterSlot[]; snapshots: RosterSnapshot[]; schedule: WeekSchedule[]
  pllDoubleHeaders: PllDoubleHeader[]; currentWeek: number; onClose: () => void
}) {
  const { homeId, awayId, week, label } = modal
  const homeTeam = teams.find(t => t.id === homeId)!
  const awayTeam = teams.find(t => t.id === awayId)!

  function getRosterWithScores(teamId: number) {
    // Use snapshot for past weeks
    let slots: Array<{ slot_index: number; player_id: number | null }>
    if (week < currentWeek) {
      const snap = snapshots.filter(s => s.team_id === teamId && s.week === week)
      slots = snap.length > 0 ? snap : rosters.filter(r => r.team_id === teamId && r.slot_index <= 9)
    } else {
      slots = rosters.filter(r => r.team_id === teamId && r.slot_index <= 9)
    }

    return slots.sort((a, b) => a.slot_index - b.slot_index).map(slot => {
      const player = slot.player_id ? players.find(p => p.id === slot.player_id) ?? null : null
      const pts = player ? getPlayerWeekScore(player.id, week, scores, players, pllDoubleHeaders) : null
      return { slot, player, pts }
    })
  }

  const homeRoster = getRosterWithScores(homeId)
  const awayRoster = getRosterWithScores(awayId)
  const homeTotal = homeRoster.reduce((s, r) => s + (r.pts ?? 0), 0)
  const awayTotal = awayRoster.reduce((s, r) => s + (r.pts ?? 0), 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 200, padding: '40px 16px', overflowY: 'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--navy-card)', border: '1px solid var(--navy-border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 700 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'sans-serif' }}>Week {week}{label ? ` · ${label}` : ''}</div>
          <button className="btn btn-sm btn-outline" onClick={onClose}>✕ Close</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, marginBottom: 24, padding: '16px', background: 'var(--navy-light)', borderRadius: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'sans-serif', color: homeTotal > awayTotal ? 'var(--green)' : 'var(--text)' }}>{homeTeam.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{homeTeam.owner_name}</div>
            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'sans-serif', color: homeTotal > awayTotal ? 'var(--green)' : 'var(--gold)' }}>{Math.round(homeTotal * 100) / 100}</div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>vs</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'sans-serif', color: awayTotal > homeTotal ? 'var(--green)' : 'var(--text)' }}>{awayTeam.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{awayTeam.owner_name}</div>
            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'sans-serif', color: awayTotal > homeTotal ? 'var(--green)' : 'var(--gold)' }}>{Math.round(awayTotal * 100) / 100}</div>
          </div>
        </div>
        <div className="grid2" style={{ gap: 16 }}>
          {[{ team: homeTeam, roster: homeRoster }, { team: awayTeam, roster: awayRoster }].map(({ team, roster }) => (
            <div key={team.id}>
              <div className="section-title">{team.name}</div>
              {roster.map(({ slot, player, pts }) => (
                <div key={slot.slot_index} style={{ display: 'grid', gridTemplateColumns: '50px minmax(0,1fr) 40px', gap: 6, padding: '5px 8px', fontSize: 12, fontFamily: 'sans-serif', borderBottom: '1px solid var(--navy-border)' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'flex', alignItems: 'center' }}>{SLOT_LABELS[slot.slot_index]}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {player && <span className={`pos pos-${player.position}`}>{player.position}</span>}
                    <span style={{ color: player ? 'var(--text)' : 'var(--muted)' }}>{player?.name ?? '—'}</span>
                  </div>
                  <div style={{ textAlign: 'right', color: 'var(--gold)', fontWeight: 600 }}>
                    {pts != null && player ? pts : ''}
                  </div>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '50px minmax(0,1fr) 40px', gap: 6, padding: '8px 8px 0', fontFamily: 'sans-serif' }}>
                <div />
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total</div>
                <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
                  {Math.round(roster.reduce((s, r) => s + (r.pts ?? 0), 0) * 100) / 100}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
