'use client'
// app/components/StandingsTab.tsx

import { useState } from 'react'
import type {
  FantasyTeam,
  Player,
  PlayerScore,
  RosterSlot,
  RosterSnapshot,
  LeagueSettings,
  WeekSchedule,
  Matchup,
  GamePick,
  PllDoubleHeader,
} from '../types'
import { calcTeamRecord } from '../lib/scoring'
import PlayoffBracket from './PlayoffBracket'

interface Props {
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

export default function StandingsTab({
  teams,
  players,
  scores,
  rosters,
  snapshots,
  settings,
  schedule,
  matchups,
  pllDoubleHeaders,
}: Props) {
  const [subTab, setSubTab] = useState<'standings' | 'playoffs'>('standings')
  const week = settings.current_week

  const rows = teams
    .map(team => {
      const rec = calcTeamRecord(
        team.id,
        week - 1,
        rosters,
        scores,
        players,
        schedule,
        matchups,
        pllDoubleHeaders,
        week,
        snapshots,
      )
      return { team, ...rec }
    })
    .sort((a, b) => b.wins - a.wins || b.points_for - a.points_for)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button
          onClick={() => setSubTab('standings')}
          className={`btn btn-sm ${subTab === 'standings' ? 'btn-gold' : 'btn-outline'}`}
        >
          Standings
        </button>
        <button
          onClick={() => setSubTab('playoffs')}
          className={`btn btn-sm ${subTab === 'playoffs' ? 'btn-gold' : 'btn-outline'}`}
        >
          Playoffs
        </button>
      </div>

      {subTab === 'playoffs' ? (
        <>
          <div className="section-title">Playoff Bracket</div>
          <PlayoffBracket
            teams={teams}
            players={players}
            scores={scores}
            rosters={rosters}
            snapshots={snapshots}
            settings={settings}
            schedule={schedule}
            matchups={matchups}
            pllDoubleHeaders={pllDoubleHeaders}
          />
        </>
      ) : (
        <>
          <div className="section-title">Standings</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '24px minmax(0,1fr) 36px 36px 60px',
              alignItems: 'center',
              gap: 6,
              padding: '7px 8px',
              color: 'var(--muted)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              borderBottom: '1px solid var(--navy-border)',
              paddingBottom: 6,
              marginBottom: 4,
            }}
          >
            <div>#</div>
            <div>Team</div>
            <div style={{ textAlign: 'center' }}>W</div>
            <div style={{ textAlign: 'center' }}>L</div>
            <div style={{ textAlign: 'center' }}>PF</div>
          </div>
          {rows.map((row, i) => (
            <div key={row.team.id}>
              {i === 4 && <div className="playoff-cut" />}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px minmax(0,1fr) 36px 36px 60px',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 8px',
                  borderRadius: 5,
                  fontFamily: 'sans-serif',
                  fontSize: 12,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-light)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ color: i < 4 ? 'var(--gold)' : 'var(--muted)', fontSize: 11 }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 13 }}>{row.team.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{row.team.owner_name}</div>
                </div>
                <div style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 600 }}>
                  {row.wins}
                </div>
                <div style={{ textAlign: 'center', color: 'var(--muted)' }}>{row.losses}</div>
                <div style={{ textAlign: 'center', color: 'var(--gold)' }}>{row.points_for}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
