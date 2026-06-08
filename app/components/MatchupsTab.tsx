'use client'
// app/components/MatchupsTab.tsx

import { useState, useRef } from 'react'
import type { FantasyTeam, Player, PlayerScore, RosterSlot, RosterSnapshot, LeagueSettings, WeekSchedule, Matchup, GamePick, PllDoubleHeader } from '../types'
import { shortName } from '../types'
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

export default function MatchupsTab({ myTeamId, teams, players, scores, rosters, snapshots, settings, schedule, matchups, gamePicks, pllDoubleHeaders }: Props) {
  const [viewWeek, setViewWeek] = useState(settings.current_week)
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

  const myMatchupIdx = weekMatchups.findIndex(m => m.homeId === myTeamId || m.awayId === myTeamId)
  const [activeIdx, setActiveIdx] = useState(() => myMatchupIdx >= 0 ? myMatchupIdx : 0)

  const handleWeekChange = (wk: number) => {
    setViewWeek(wk)
    const newMatchups = matchups.filter(m => m.week === wk).map(m => ({ homeId: m.home_team_id, awayId: m.away_team_id }))
    const myIdx = newMatchups.findIndex(m => m.homeId === myTeamId || m.awayId === myTeamId)
    setActiveIdx(myIdx >= 0 ? myIdx : 0)
  }

  const touchStartX = useRef<number | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) setActiveIdx(i => Math.min(i + 1, weekMatchups.length - 1))
      else setActiveIdx(i => Math.max(i - 1, 0))
    }
    touchStartX.current = null
  }

  function teamScore(teamId: number) {
    return getTeamWeekScore(teamId, viewWeek, rosters, scores, players, pllDoubleHeaders, currentWeek, snapshots)
  }

function getRosterWithScores(teamId: number) {
    let slots: Array<{ slot_index: number; player_id: number | null }>
    if (viewWeek < currentWeek) {
      const snap = snapshots.filter(s => s.team_id === teamId && s.week === viewWeek)
      slots = snap.length > 0
        ? snap
        : rosters.filter(r => r.team_id === teamId && r.player_id !== null)
    } else {
      slots = rosters.filter(r => r.team_id === teamId && r.player_id !== null)
    }
    return slots
      .sort((a, b) => a.slot_index - b.slot_index)
      .map(slot => {
        const player = slot.player_id ? players.find(p => p.id === slot.player_id) ?? null : null
        const pts = player ? getPlayerWeekScore(player.id, viewWeek, scores, players, pllDoubleHeaders) : null
        return { slot, player, pts }
      })
  }

  const current = weekMatchups[activeIdx]
  const homeTeam = current ? teams.find(t => t.id === current.homeId) : null
  const awayTeam = current ? teams.find(t => t.id === current.awayId) : null
  const homeScore = current ? teamScore(current.homeId) : 0
  const awayScore = current ? teamScore(current.awayId) : 0
  const homeWin = isPast && homeScore > awayScore
  const awayWin = isPast && awayScore > homeScore

  const homeRoster = current ? getRosterWithScores(current.homeId) : []
  const awayRoster = current ? getRosterWithScores(current.awayId) : []
  const homeTotal = Math.round(homeRoster.filter(r => r.slot.slot_index < 10).reduce((s, r) => s + (r.pts ?? 0), 0) * 100) / 100
  const awayTotal = Math.round(awayRoster.filter(r => r.slot.slot_index < 10).reduce((s, r) => s + (r.pts ?? 0), 0) * 100) / 100

  const playerRow = (player: Player | null, pts: number | null, isBench: boolean) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: isBench ? '4px 4px' : '5px 4px',
      fontSize: isBench ? 10 : 11, fontFamily: 'sans-serif',
      borderBottom: '1px solid var(--navy-border)',
      opacity: isBench ? 0.6 : 1,
    }}>
      {player
        ? <span className={`pos pos-${player.position}`} style={{ fontSize: isBench ? 8 : 9, flexShrink: 0 }}>{player.position}</span>
        : <span style={{ width: 24, flexShrink: 0 }} />
      }
      <span style={{ flex: 1, color: player ? 'var(--text)' : 'var(--muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {player ? shortName(player.name) : '—'}
        {player && player.position !== 'G' && player.position !== 'FO' && (
          <span style={{ color: 'var(--muted)', fontSize: isBench ? 8 : 9, marginLeft: 4 }}>{player.pll_team}</span>
        )}
      </span>
      <span style={{ color: 'var(--gold)', fontWeight: isBench ? 400 : 600, fontSize: 11, flexShrink: 0, opacity: isBench ? 0.6 : 1 }}>
        {pts != null && player ? pts : ''}
      </span>
    </div>
  )

  return (
    <div>
      {/* Week selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginRight: 4, flexShrink: 0 }}>Week:</span>
        {Array.from({ length: 10 }, (_, i) => {
          const wk = i + 1
          const isPlayoffWk = wk >= 9
          return (
            <button key={wk} onClick={() => handleWeekChange(wk)} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 5, fontSize: 11, fontFamily: 'sans-serif',
              cursor: 'pointer', border: viewWeek === wk ? 'none' : '1px solid var(--navy-border)',
              background: viewWeek === wk ? (isPlayoffWk ? 'var(--gold-dark)' : 'var(--gold)') : 'transparent',
              color: viewWeek === wk ? '#0a0f1a' : isPlayoffWk ? 'var(--gold)' : 'var(--muted)',
              fontWeight: viewWeek === wk ? 700 : 400, flexShrink: 0,
            }}>
              {wk < 9 ? wk : wk === 9 ? 'SF' : '🏆'}
            </button>
          )
        })}
      </div>

      {weekMatchups.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'sans-serif', padding: '20px 0' }}>
          No matchups scheduled for this week yet.
        </div>
      ) : (
        <>
          {/* Swipeable matchup header */}
          <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ userSelect: 'none' }}>
            {/* Dots + arrows */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
              <button onClick={() => setActiveIdx(i => Math.max(i - 1, 0))} disabled={activeIdx === 0}
                style={{ background: 'none', border: 'none', cursor: activeIdx === 0 ? 'default' : 'pointer', color: activeIdx === 0 ? 'var(--navy-border)' : 'var(--muted)', fontSize: 18, padding: '0 4px' }}>
                ‹
              </button>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {weekMatchups.map((_, i) => (
                  <button key={i} onClick={() => setActiveIdx(i)} style={{
                    width: i === activeIdx ? 20 : 7, height: 7, borderRadius: 4,
                    background: i === activeIdx ? 'var(--gold)' : 'var(--navy-border)',
                    border: 'none', cursor: 'pointer', padding: 0, transition: 'all .2s',
                  }} />
                ))}
              </div>
              <button onClick={() => setActiveIdx(i => Math.min(i + 1, weekMatchups.length - 1))} disabled={activeIdx === weekMatchups.length - 1}
                style={{ background: 'none', border: 'none', cursor: activeIdx === weekMatchups.length - 1 ? 'default' : 'pointer', color: activeIdx === weekMatchups.length - 1 ? 'var(--navy-border)' : 'var(--muted)', fontSize: 18, padding: '0 4px' }}>
                ›
              </button>
            </div>

            {/* Score header */}
            {homeTeam && awayTeam && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, padding: '16px 12px', background: 'var(--navy-card)', border: `1px solid ${current.homeId === myTeamId || current.awayId === myTeamId ? 'var(--gold-dark)' : 'var(--navy-border)'}`, borderRadius: 10, marginBottom: 20 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'sans-serif', color: homeWin ? 'var(--green)' : 'var(--text)', lineHeight: 1.2 }}>{homeTeam.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 6 }}>{homeTeam.owner_name}</div>
                  <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'sans-serif', color: homeWin ? 'var(--green)' : awayWin ? 'var(--muted)' : 'var(--gold)' }}>{homeTotal}</div>
                  {homeWin && <div style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'sans-serif', fontWeight: 600 }}>WIN</div>}
                  {awayWin && <div style={{ fontSize: 10, color: 'var(--red)', fontFamily: 'sans-serif' }}>LOSS</div>}
                </div>
                <div style={{ textAlign: 'center', fontFamily: 'sans-serif', fontSize: 12, color: 'var(--muted)' }}>
                  {current.label ?? 'vs'}
                  {isPlayoff && seeds.length >= 4 && (
                    <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 4 }}>
                      #{seeds.findIndex(s => s.team.id === current.homeId) + 1} vs #{seeds.findIndex(s => s.team.id === current.awayId) + 1}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'sans-serif', color: awayWin ? 'var(--green)' : 'var(--text)', lineHeight: 1.2 }}>{awayTeam.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 6 }}>{awayTeam.owner_name}</div>
                  <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'sans-serif', color: awayWin ? 'var(--green)' : homeWin ? 'var(--muted)' : 'var(--gold)' }}>{awayTotal}</div>
                  {awayWin && <div style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'sans-serif', fontWeight: 600 }}>WIN</div>}
                  {homeWin && <div style={{ fontSize: 10, color: 'var(--red)', fontFamily: 'sans-serif' }}>LOSS</div>}
                </div>
              </div>
            )}
          </div>

          {/* Box score */}
          {homeTeam && awayTeam && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[{ team: homeTeam, roster: homeRoster, total: homeTotal }, { team: awayTeam, roster: awayRoster, total: awayTotal }].map(({ team, roster, total }) => (
                <div key={team.id}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6, textAlign: 'center' }}>
                    {team.name}
                  </div>

                  {/* Starters */}
                  {roster.filter(r => r.slot.slot_index < 10).map(({ slot, player, pts }) => (
                    <div key={slot.slot_index}>{playerRow(player, pts, false)}</div>
                  ))}

                  {/* Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 4px', fontFamily: 'sans-serif', borderBottom: '1px solid var(--navy-border)' }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{total}</span>
                  </div>

                  {/* Bench */}
                  <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '6px 4px 2px', fontFamily: 'sans-serif' }}>Bench</div>
                  {roster.filter(r => r.slot.slot_index >= 10).map(({ slot, player, pts }) => (
                    <div key={slot.slot_index}>{playerRow(player, pts, true)}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
