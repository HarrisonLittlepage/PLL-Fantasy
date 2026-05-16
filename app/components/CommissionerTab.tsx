'use client'
// app/components/CommissionerTab.tsx

import { apiFetch } from '../lib/api-fetch'
import { useState } from 'react'
import type { FantasyTeam, Player, PlayerScore, RosterSlot, LeagueSettings, WeekSchedule, Matchup, GamePick, PllDoubleHeader } from '../types'
import { getPlayoffSeeds } from '../lib/scoring'

const PLL_TEAMS = ['Archers', 'Atlas', 'Cannons', 'Chaos', 'Outlaws', 'Redwoods', 'Waterdogs', 'Whipsnakes']

interface Props {
  teams: FantasyTeam[]
  players: Player[]
  scores: PlayerScore[]
  rosters: RosterSlot[]
  settings: LeagueSettings
  schedule: WeekSchedule[]
  matchups: Matchup[]
  gamePicks: GamePick[]
  pllDoubleHeaders: PllDoubleHeader[]
  onRefresh: () => void
}

type CommView = 'settings' | 'users' | 'scores'

export default function CommissionerTab({ teams, players, scores, settings, schedule, matchups, rosters, gamePicks, pllDoubleHeaders, onRefresh }: Props) {
  const [view, setView] = useState<CommView>('settings')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  function flash(text: string, type: 'success' | 'error' = 'success') {
    setMsg(text); setMsgType(type); setTimeout(() => setMsg(''), 4000)
  }

  return (
    <div>
      <div className="comm-panel">
        <div className="comm-header">⚙ Commissioner Panel</div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['settings', 'users', 'scores'] as CommView[]).map(v => (
            <button key={v} className={`btn btn-sm ${view === v ? 'btn-comm' : 'btn-outline'}`} onClick={() => setView(v)}>
              {v === 'settings' ? 'League Settings' : v === 'users' ? 'Manage Users' : 'Enter Scores'}
            </button>
          ))}
        </div>

        {msg && (
          <div style={{ padding: '7px 12px', background: msgType === 'success' ? '#1a3a2a' : '#3a1a1a', border: `1px solid ${msgType === 'success' ? 'var(--green)' : 'var(--red)'}`, borderRadius: 5, fontSize: 12, color: msgType === 'success' ? 'var(--green)' : '#e06060', fontFamily: 'sans-serif', marginBottom: 14 }}>
            {msg}
          </div>
        )}

        {view === 'settings' && <SettingsView settings={settings} schedule={schedule} matchups={matchups} rosters={rosters} scores={scores} gamePicks={gamePicks} teams={teams} players={players} pllDoubleHeaders={pllDoubleHeaders} saving={saving} setSaving={setSaving} flash={flash} onRefresh={onRefresh} />}
        {view === 'users' && <UsersView teams={teams} flash={flash} saving={saving} setSaving={setSaving} onRefresh={onRefresh} />}
        {view === 'scores' && <ScoresView players={players} scores={scores} settings={settings} pllDoubleHeaders={pllDoubleHeaders} flash={flash} saving={saving} setSaving={setSaving} onRefresh={onRefresh} />}
      </div>
    </div>
  )
}

// ── SETTINGS VIEW ─────────────────────────────────────────────────────────────
function SettingsView({ settings, schedule, matchups, rosters, scores, gamePicks, teams, players, pllDoubleHeaders, saving, setSaving, flash, onRefresh }: any) {
  const seeds = getPlayoffSeeds(teams, rosters, scores, players, schedule, matchups, pllDoubleHeaders)
  const [dhWeek, setDhWeek] = useState(settings.current_week)
  const [dhTeam, setDhTeam] = useState(PLL_TEAMS[0])

  async function updateSettings(patch: Partial<{ current_week: number; bye_scoring_mode: string }>) {
    setSaving(true)
    const res = await apiFetch('/api/commissioner/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) { onRefresh(); flash('Settings saved') }
    else { const d = await res.json(); flash(d.error ?? 'Error saving', 'error') }
    setSaving(false)
  }

  async function addDoubleHeader() {
    setSaving(true)
    const res = await apiFetch('/api/commissioner/double-header', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week: dhWeek, pll_team: dhTeam }),
    })
    if (res.ok) { onRefresh(); flash(`${dhTeam} marked as double-header for week ${dhWeek}`) }
    else { const d = await res.json(); flash(d.error ?? 'Error saving', 'error') }
    setSaving(false)
  }

  async function removeDoubleHeader(week: number, pll_team: string) {
    setSaving(true)
    const res = await apiFetch('/api/commissioner/double-header', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week, pll_team }),
    })
    if (res.ok) { onRefresh(); flash(`Removed double-header for ${pll_team} week ${week}`) }
    else { const d = await res.json(); flash(d.error ?? 'Error removing', 'error') }
    setSaving(false)
  }

  return (
    <div>
      <div className="section-title" style={{ color: 'var(--comm-purple)' }}>League Settings</div>

      <div className="toggle-row">
        <div>
          <div style={{ fontSize: 13, fontFamily: 'sans-serif' }}>Current week</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginTop: 2 }}>
            Week {settings.current_week} of 10
            {settings.current_week >= 9 ? ' · Playoffs' : ' · Regular Season'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn btn-sm btn-outline" disabled={settings.current_week <= 1 || saving} onClick={() => updateSettings({ current_week: settings.current_week - 1 })}>◀</button>
          <span style={{ fontFamily: 'sans-serif', fontSize: 13, minWidth: 20, textAlign: 'center' }}>{settings.current_week}</span>
          <button className="btn btn-sm btn-outline" disabled={settings.current_week >= 10 || saving} onClick={() => updateSettings({ current_week: settings.current_week + 1 })}>▶</button>
        </div>
      </div>

      {/* Double-header management */}
      <div style={{ marginTop: 20 }}>
        <div className="section-title" style={{ color: 'var(--comm-purple)' }}>PLL Double-Header Weeks</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 12 }}>
          Mark which PLL teams play two games in a given week. Their players' scores will be averaged automatically.
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>Week</label>
            <select className="input" style={{ width: 80 }} value={dhWeek} onChange={e => setDhWeek(parseInt(e.target.value))}>
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i + 1} value={i + 1}>Wk {i + 1}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>PLL Team</label>
            <select className="input" style={{ width: 140 }} value={dhTeam} onChange={e => setDhTeam(e.target.value)}>
              {PLL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-comm" onClick={addDoubleHeader} disabled={saving}>
              + Add Double-Header
            </button>
          </div>
        </div>

        {/* Existing double headers */}
        {pllDoubleHeaders.length > 0 ? (
          <div>
            {pllDoubleHeaders
              .slice()
              .sort((a: PllDoubleHeader, b: PllDoubleHeader) => a.week - b.week || a.pll_team.localeCompare(b.pll_team))
              .map((dh: PllDoubleHeader) => (
                <div key={`${dh.week}-${dh.pll_team}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--navy-light)', borderRadius: 6, marginBottom: 6, border: '1px solid #4a2060' }}>
                  <span style={{ fontSize: 10, color: '#b06ade', fontFamily: 'sans-serif', minWidth: 50 }}>Week {dh.week}</span>
                  <span style={{ flex: 1, fontSize: 13, fontFamily: 'sans-serif', color: '#b06ade' }}>{dh.pll_team}</span>
                  <button className="btn btn-sm btn-outline" style={{ fontSize: 10 }} onClick={() => removeDoubleHeader(dh.week, dh.pll_team)} disabled={saving}>
                    Remove
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'sans-serif' }}>No double-header weeks registered yet.</div>
        )}
      </div>

      {/* Playoff picture */}
      <div style={{ marginTop: 20 }}>
        <div className="section-title" style={{ color: 'var(--comm-purple)' }}>Current Playoff Picture</div>
        {seeds.map((s: any, i: number) => (
          <div key={s.team.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--navy-light)', borderRadius: 6, marginBottom: 6, border: '1px solid var(--navy-border)' }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', minWidth: 16 }}>#{i + 1}</span>
            <div style={{ flex: 1, fontFamily: 'sans-serif', fontSize: 13 }}>{s.team.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{s.wins}-{s.losses} · {s.points_for} PF</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── USERS VIEW ────────────────────────────────────────────────────────────────
function UsersView({ teams, flash, saving, setSaving, onRefresh }: any) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [teamId, setTeamId] = useState<string>('')
  const [isCommissioner, setIsCommissioner] = useState(false)
  const [profiles, setProfiles] = useState<any[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)

  useState(() => {
    fetch('/api/commissioner/users')
      .then(r => r.json())
      .then(d => { setProfiles(d.users ?? []); setLoadingProfiles(false) })
      .catch(() => setLoadingProfiles(false))
  })

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password || !displayName) { flash('All fields required', 'error'); return }
    setSaving(true)
    const res = await apiFetch('/api/commissioner/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name: displayName, team_id: teamId ? parseInt(teamId) : null, is_commissioner: isCommissioner }),
    })
    const d = await res.json()
    if (res.ok) {
      flash(`Account created for ${displayName}`)
      setEmail(''); setPassword(''); setDisplayName(''); setTeamId(''); setIsCommissioner(false)
      onRefresh()
      fetch('/api/commissioner/users').then(r => r.json()).then(d => setProfiles(d.users ?? []))
    } else {
      flash(d.error ?? 'Error creating user', 'error')
    }
    setSaving(false)
  }

  async function toggleCommissioner(userId: string, current: boolean) {
    const res = await apiFetch('/api/commissioner/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, is_commissioner: !current }),
    })
    if (res.ok) {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, is_commissioner: !current } : p))
      flash(!current ? 'Commissioner role granted' : 'Commissioner role removed')
    } else {
      flash('Error updating role', 'error')
    }
  }

  return (
    <div>
      <div className="section-title" style={{ color: 'var(--comm-purple)' }}>Create User Account</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 16 }}>
        Create accounts for each league member. Share their email and password directly.
      </div>
      <form onSubmit={createUser} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>Display Name</label>
          <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Jake" required />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>Email</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jake@example.com" required />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>Temporary Password</label>
          <input className="input" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="at least 6 characters" required />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', fontFamily: 'sans-serif', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>Assign to Team (optional)</label>
          <select className="input" value={teamId} onChange={e => setTeamId(e.target.value)} style={{ cursor: 'pointer' }}>
            <option value="">— No team yet —</option>
            {teams.map((t: FantasyTeam) => (
              <option key={t.id} value={t.id}>{t.name} ({t.owner_name})</option>
            ))}
          </select>
        </div>
        <div className="toggle-row">
          <div>
            <div style={{ fontSize: 13, fontFamily: 'sans-serif' }}>Commissioner role</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif', marginTop: 2 }}>Can access league settings and enter scores</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={isCommissioner} onChange={e => setIsCommissioner(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
        <button className="btn btn-comm" type="submit" disabled={saving} style={{ marginTop: 4 }}>
          {saving ? 'Creating...' : 'Create Account'}
        </button>
      </form>

      <div style={{ marginTop: 28 }}>
        <div className="section-title" style={{ color: 'var(--comm-purple)' }}>Manage Existing Users</div>
        {loadingProfiles && <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'sans-serif' }}>Loading...</div>}
        {profiles.map(p => {
          const team = teams.find((t: FantasyTeam) => t.id === p.team_id)
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--navy-light)', borderRadius: 6, marginBottom: 6, border: '1px solid var(--navy-border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontFamily: 'sans-serif' }}>{p.display_name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>{p.email} · {team ? team.name : 'No team'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {p.is_commissioner && <span className="pill pill-comm">Commissioner</span>}
                <label className="toggle" title={p.is_commissioner ? 'Remove commissioner role' : 'Grant commissioner role'}>
                  <input type="checkbox" checked={!!p.is_commissioner} onChange={() => toggleCommissioner(p.id, !!p.is_commissioner)} />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          )
        })}
        {!loadingProfiles && profiles.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'sans-serif' }}>No users yet.</div>
        )}
      </div>
    </div>
  )
}

// ── SCORES VIEW ───────────────────────────────────────────────────────────────
function ScoresView({ players, scores, settings, pllDoubleHeaders, flash, saving, setSaving, onRefresh }: any) {
  const [selectedWeek, setSelectedWeek] = useState(settings.current_week)
  const [localScores, setLocalScores] = useState<Record<string, number>>({})

  const isDoubleHeaderWeek = pllDoubleHeaders.some((dh: PllDoubleHeader) => dh.week === selectedWeek)

  function getScore(playerId: number, game: string) {
    const key = `${playerId}-${game}`
    if (key in localScores) return localScores[key]
    return scores.find((s: any) => s.player_id === playerId && s.week === selectedWeek && s.game === game)?.points ?? ''
  }

  function setScore(playerId: number, game: string, val: string) {
    const key = `${playerId}-${game}`
    setLocalScores(prev => ({ ...prev, [key]: val === '' ? 0 : parseFloat(val) }))
  }

  async function saveScores() {
    setSaving(true)
    const payload = Object.entries(localScores).map(([key, points]) => {
      const [playerId, game] = key.split('-')
      return { player_id: parseInt(playerId), week: selectedWeek, game, points }
    })
    if (payload.length === 0) { flash('No changes to save', 'error'); setSaving(false); return }

    const res = await apiFetch('/api/commissioner/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scores: payload }),
    })
    const d = await res.json()
    if (res.ok) { flash(`Saved ${d.count} score entries`); setLocalScores({}); onRefresh() }
    else { flash(d.error ?? 'Error saving scores', 'error') }
    setSaving(false)
  }

  const positions = ['A', 'M', 'D', 'SSDM', 'LSM', 'FO', 'G']

  // For double-header weeks, show game A and B columns for teams with double headers
  function gamesForPlayer(p: Player): string[] {
    const hasDoubleHeader = pllDoubleHeaders.some((dh: PllDoubleHeader) => dh.week === selectedWeek && dh.pll_team === p.pll_team)
    return hasDoubleHeader ? ['A', 'B'] : ['A']
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div className="section-title" style={{ color: 'var(--comm-purple)', margin: 0 }}>Enter Weekly Scores</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'sans-serif' }}>Week:</label>
          <select className="input" style={{ width: 80 }} value={selectedWeek} onChange={e => { setSelectedWeek(parseInt(e.target.value)); setLocalScores({}) }}>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Wk {i + 1}</option>
            ))}
          </select>
          <button className="btn btn-sm btn-comm" disabled={saving || Object.keys(localScores).length === 0} onClick={saveScores}>
            {saving ? 'Saving...' : `Save ${Object.keys(localScores).length > 0 ? `(${Object.keys(localScores).length})` : ''}`}
          </button>
        </div>
      </div>

      {isDoubleHeaderWeek && (
        <div style={{ padding: '6px 10px', background: '#1a0f2a', border: '1px solid #4a2060', borderRadius: 5, fontSize: 11, color: '#b06ade', fontFamily: 'sans-serif', marginBottom: 12 }}>
          Double-header week — players on double-header PLL teams show Game A and Game B columns.
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="score-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Player</th>
              <th>Team</th>
              <th style={{ textAlign: 'center' }}>Game A</th>
              <th style={{ textAlign: 'center' }}>Game B</th>
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => {
              const posPlayers = players.filter((p: Player) => p.position === pos)
              if (posPlayers.length === 0) return null
              return [
                <tr key={`header-${pos}`}>
                  <td colSpan={5} style={{ paddingTop: 10, paddingBottom: 4, fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{pos}</td>
                </tr>,
                ...posPlayers.map((p: Player) => {
                  const games = gamesForPlayer(p)
                  return (
                    <tr key={p.id}>
                      <td><span className={`pos pos-${p.position}`}>{p.position}</span></td>
                      <td style={{ color: 'var(--text)' }}>{p.name}</td>
                      <td style={{ color: 'var(--muted)' }}>{p.pll_team}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" step="0.01" min={-100} max={200}
                          value={getScore(p.id, 'A')}
                          onChange={e => setScore(p.id, 'A', e.target.value)}
                          style={{ width: 60, background: 'var(--navy)', border: '1px solid var(--navy-border)', color: 'var(--text)', padding: '3px 6px', borderRadius: 4, fontSize: 12, textAlign: 'center' }} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {games.includes('B') ? (
                          <input type="number" step="0.01" min={-100} max={200}
                            value={getScore(p.id, 'B')}
                            onChange={e => setScore(p.id, 'B', e.target.value)}
                            style={{ width: 60, background: 'var(--navy)', border: '1px solid var(--navy-border)', color: 'var(--text)', padding: '3px 6px', borderRadius: 4, fontSize: 12, textAlign: 'center' }} />
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
