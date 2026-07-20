import { describe, it, expect } from 'vitest'
import {
  getPlayerWeekScore,
  getRosterForWeek,
  getTeamWeekScore,
  calcTeamRecord,
  getFullStandings,
  getPlayoffSeeds,
} from './scoring'
import {
  makePlayer,
  makeScore,
  makeRosterSlot,
  makeSnapshot,
  makeTeam,
  makeWeek,
  makeMatchup,
  makeDoubleHeader,
} from './test-fixtures'

describe('getPlayerWeekScore', () => {
  const players = [makePlayer({ id: 1, pll_team: 'Atlas' })]

  it('returns game A points for a normal single-game week', () => {
    const scores = [makeScore({ player_id: 1, week: 1, game: 'A', points: 20 })]
    expect(getPlayerWeekScore(1, 1, scores, players, [])).toBe(20)
  })

  it('returns 0 when the player has no score for the week', () => {
    expect(getPlayerWeekScore(1, 1, [], players, [])).toBe(0)
  })

  it('ignores game B when the team is NOT a double-header that week', () => {
    const scores = [
      makeScore({ player_id: 1, week: 1, game: 'A', points: 20 }),
      makeScore({ player_id: 1, week: 1, game: 'B', points: 40 }),
    ]
    // No double-header registered -> only game A counts.
    expect(getPlayerWeekScore(1, 1, scores, players, [])).toBe(20)
  })

  it('averages game A and B when the team has a double-header that week', () => {
    const scores = [
      makeScore({ player_id: 1, week: 1, game: 'A', points: 20 }),
      makeScore({ player_id: 1, week: 1, game: 'B', points: 40 }),
    ]
    const dh = [makeDoubleHeader({ week: 1, pll_team: 'Atlas' })]
    expect(getPlayerWeekScore(1, 1, scores, players, dh)).toBe(30)
  })

  it('falls back to game A alone when double-header registered but game B missing', () => {
    const scores = [makeScore({ player_id: 1, week: 1, game: 'A', points: 20 })]
    const dh = [makeDoubleHeader({ week: 1, pll_team: 'Atlas' })]
    expect(getPlayerWeekScore(1, 1, scores, players, dh)).toBe(20)
  })

  it('treats a present game B of 0 as a real score (averages, not fallback)', () => {
    const scores = [
      makeScore({ player_id: 1, week: 1, game: 'A', points: 20 }),
      makeScore({ player_id: 1, week: 1, game: 'B', points: 0 }),
    ]
    const dh = [makeDoubleHeader({ week: 1, pll_team: 'Atlas' })]
    expect(getPlayerWeekScore(1, 1, scores, players, dh)).toBe(10)
  })

  it('applies the double-header only for the matching week', () => {
    const scores = [
      makeScore({ player_id: 1, week: 2, game: 'A', points: 20 }),
      makeScore({ player_id: 1, week: 2, game: 'B', points: 40 }),
    ]
    const dh = [makeDoubleHeader({ week: 1, pll_team: 'Atlas' })]
    // DH is week 1, we score week 2 -> no averaging.
    expect(getPlayerWeekScore(1, 2, scores, players, dh)).toBe(20)
  })
})

describe('getRosterForWeek', () => {
  const live = [
    makeRosterSlot({ team_id: 1, slot_index: 0, player_id: 100 }),
    makeRosterSlot({ team_id: 1, slot_index: 10, player_id: 101 }), // bench
    makeRosterSlot({ team_id: 2, slot_index: 0, player_id: 200 }),
  ]

  it('uses the live roster for the current week', () => {
    const result = getRosterForWeek(1, 3, 3, live, [])
    expect(result.map(r => r.player_id)).toEqual([100]) // bench (>=10) excluded, other team excluded
  })

  it('uses the live roster for a future week', () => {
    const result = getRosterForWeek(1, 5, 3, live, [])
    expect(result.map(r => r.player_id)).toEqual([100])
  })

  it('uses the snapshot for a completed (past) week', () => {
    const snaps = [
      makeSnapshot({ team_id: 1, week: 2, slot_index: 0, player_id: 999 }),
      makeSnapshot({ team_id: 2, week: 2, slot_index: 0, player_id: 888 }),
    ]
    const result = getRosterForWeek(1, 2, 3, live, snaps)
    expect(result.map(r => r.player_id)).toEqual([999])
  })

  it('falls back to the live roster for a past week with no snapshot', () => {
    const result = getRosterForWeek(1, 2, 3, live, [])
    expect(result.map(r => r.player_id)).toEqual([100])
  })
})

describe('getTeamWeekScore', () => {
  it('sums only the 10 starting slots, skipping bench and empty slots', () => {
    const roster = [
      makeRosterSlot({ team_id: 1, slot_index: 0, player_id: 1 }),
      makeRosterSlot({ team_id: 1, slot_index: 1, player_id: 2 }),
      makeRosterSlot({ team_id: 1, slot_index: 2, player_id: null }), // empty
      makeRosterSlot({ team_id: 1, slot_index: 10, player_id: 3 }), // bench, must be ignored
    ]
    const players = [makePlayer({ id: 1 }), makePlayer({ id: 2 }), makePlayer({ id: 3 })]
    const scores = [
      makeScore({ player_id: 1, week: 1, points: 15 }),
      makeScore({ player_id: 2, week: 1, points: 25 }),
      makeScore({ player_id: 3, week: 1, points: 99 }), // bench score, must not count
    ]
    expect(getTeamWeekScore(1, 1, roster, scores, players, [], 1, [])).toBe(40)
  })

  it('returns 0 for a team with no starters scored', () => {
    expect(getTeamWeekScore(1, 1, [], [], [], [], 1, [])).toBe(0)
  })
})

describe('calcTeamRecord', () => {
  // Two teams, one weekly matchup. Team 1 has a strong scorer, team 2 a weak one.
  const players = [
    makePlayer({ id: 1 }), // team 1 starter
    makePlayer({ id: 2 }), // team 2 starter
  ]
  const roster = [
    makeRosterSlot({ team_id: 1, slot_index: 0, player_id: 1 }),
    makeRosterSlot({ team_id: 2, slot_index: 0, player_id: 2 }),
  ]
  const schedule = [makeWeek({ week: 1 }), makeWeek({ week: 2 })]
  const matchups = [
    makeMatchup({ week: 1, home_team_id: 1, away_team_id: 2 }),
    makeMatchup({ week: 2, home_team_id: 1, away_team_id: 2 }),
  ]

  it('counts a higher-scoring week as a win and lower as a loss', () => {
    const scores = [
      makeScore({ player_id: 1, week: 1, points: 30 }),
      makeScore({ player_id: 2, week: 1, points: 10 }),
    ]
    const rec = calcTeamRecord(1, 1, roster, scores, players, schedule, matchups, [])
    expect(rec).toEqual({ wins: 1, losses: 0, points_for: 30 })
    const oppRec = calcTeamRecord(2, 1, roster, scores, players, schedule, matchups, [])
    expect(oppRec).toEqual({ wins: 0, losses: 1, points_for: 10 })
  })

  it('counts a tie as a loss (myScore > oppScore is the only win condition)', () => {
    const scores = [
      makeScore({ player_id: 1, week: 1, points: 20 }),
      makeScore({ player_id: 2, week: 1, points: 20 }),
    ]
    const rec = calcTeamRecord(1, 1, roster, scores, players, schedule, matchups, [])
    expect(rec).toEqual({ wins: 0, losses: 1, points_for: 20 })
  })

  it('accumulates across multiple weeks', () => {
    const scores = [
      makeScore({ player_id: 1, week: 1, points: 30 }),
      makeScore({ player_id: 2, week: 1, points: 10 }),
      makeScore({ player_id: 1, week: 2, points: 5 }),
      makeScore({ player_id: 2, week: 2, points: 40 }),
    ]
    // upToWeek = 2 -> weeks 1 and 2 both count.
    const rec = calcTeamRecord(1, 2, roster, scores, players, schedule, matchups, [])
    expect(rec).toEqual({ wins: 1, losses: 1, points_for: 35 })
  })

  it('caps counted weeks at 8 even if upToWeek is larger', () => {
    const bigSchedule = Array.from({ length: 10 }, (_, i) => makeWeek({ week: i + 1 }))
    const bigMatchups = Array.from({ length: 10 }, (_, i) =>
      makeMatchup({ week: i + 1, home_team_id: 1, away_team_id: 2 }),
    )
    // Team 1 wins every week it's scored.
    const scores = Array.from({ length: 10 }, (_, i) => [
      makeScore({ player_id: 1, week: i + 1, points: 30 }),
      makeScore({ player_id: 2, week: i + 1, points: 10 }),
    ]).flat()
    const rec = calcTeamRecord(1, 10, roster, scores, players, bigSchedule, bigMatchups, [])
    // Only weeks 1-8 counted -> 8 wins, not 10.
    expect(rec.wins).toBe(8)
    expect(rec.losses).toBe(0)
  })

  it('skips weeks that are not regular season', () => {
    const mixedSchedule = [makeWeek({ week: 1 }), makeWeek({ week: 2, week_type: 'playoffs' })]
    const scores = [
      makeScore({ player_id: 1, week: 1, points: 30 }),
      makeScore({ player_id: 2, week: 1, points: 10 }),
      makeScore({ player_id: 1, week: 2, points: 30 }),
      makeScore({ player_id: 2, week: 2, points: 10 }),
    ]
    const rec = calcTeamRecord(1, 2, roster, scores, players, mixedSchedule, matchups, [])
    // Week 2 is playoffs -> not counted. Only the week-1 win.
    expect(rec).toEqual({ wins: 1, losses: 0, points_for: 30 })
  })

  it('skips weeks where the team has no matchup', () => {
    const oneMatchup = [makeMatchup({ week: 1, home_team_id: 1, away_team_id: 2 })]
    const scores = [
      makeScore({ player_id: 1, week: 1, points: 30 }),
      makeScore({ player_id: 2, week: 1, points: 10 }),
      makeScore({ player_id: 1, week: 2, points: 30 }),
    ]
    const rec = calcTeamRecord(1, 2, roster, scores, players, schedule, oneMatchup, [])
    expect(rec).toEqual({ wins: 1, losses: 0, points_for: 30 })
  })

  it('rounds points_for to two decimals', () => {
    // Force a fractional total via a double-header average: (10 + 15) / 2 = 12.5
    const dhPlayers = [makePlayer({ id: 1, pll_team: 'Atlas' }), makePlayer({ id: 2 })]
    const scores = [
      makeScore({ player_id: 1, week: 1, game: 'A', points: 10 }),
      makeScore({ player_id: 1, week: 1, game: 'B', points: 15 }),
      makeScore({ player_id: 2, week: 1, points: 5 }),
    ]
    const dh = [makeDoubleHeader({ week: 1, pll_team: 'Atlas' })]
    const rec = calcTeamRecord(1, 1, roster, scores, dhPlayers, schedule, matchups, dh)
    expect(rec.points_for).toBe(12.5)
    expect(rec.wins).toBe(1)
  })
})

describe('getFullStandings', () => {
  const teams = [makeTeam({ id: 1, name: 'A' }), makeTeam({ id: 2, name: 'B' })]
  const roster = [
    makeRosterSlot({ team_id: 1, slot_index: 0, player_id: 1 }),
    makeRosterSlot({ team_id: 2, slot_index: 0, player_id: 2 }),
  ]
  const players = [makePlayer({ id: 1 }), makePlayer({ id: 2 })]
  const schedule = [makeWeek({ week: 1 })]
  const matchups = [makeMatchup({ week: 1, home_team_id: 1, away_team_id: 2 })]

  it('ranks by wins (winner first)', () => {
    const scores = [
      makeScore({ player_id: 1, week: 1, points: 30 }),
      makeScore({ player_id: 2, week: 1, points: 10 }),
    ]
    const standings = getFullStandings(teams, roster, scores, players, schedule, matchups, [])
    expect(standings.map(s => s.team.id)).toEqual([1, 2])
    expect(standings[0].wins).toBe(1)
  })

  it('breaks ties on wins using points_for', () => {
    // No matchups -> both teams 0-0, so ordering falls to points_for.
    // Give team 2 more points via a separate week with no matchup? Simpler: both 0 wins,
    // points_for both 0 here; instead use a scenario with equal wins but different PF.
    const twoWeekSchedule = [makeWeek({ week: 1 }), makeWeek({ week: 2 })]
    const twoWeekMatchups = [
      makeMatchup({ week: 1, home_team_id: 1, away_team_id: 2 }),
      makeMatchup({ week: 2, home_team_id: 1, away_team_id: 2 }),
    ]
    // Each team wins one week; team 2's winning margin is bigger -> higher PF.
    const scores = [
      makeScore({ player_id: 1, week: 1, points: 30 }),
      makeScore({ player_id: 2, week: 1, points: 10 }),
      makeScore({ player_id: 1, week: 2, points: 5 }),
      makeScore({ player_id: 2, week: 2, points: 100 }),
    ]
    const standings = getFullStandings(
      teams,
      roster,
      scores,
      players,
      twoWeekSchedule,
      twoWeekMatchups,
      [],
    )
    // Both 1-1, team 2 has 110 PF vs team 1's 35 -> team 2 ranked first.
    expect(standings.map(s => s.team.id)).toEqual([2, 1])
  })
})

describe('getPlayoffSeeds', () => {
  it('returns at most the top 4 teams', () => {
    const teams = Array.from({ length: 6 }, (_, i) => makeTeam({ id: i + 1, name: `T${i + 1}` }))
    const seeds = getPlayoffSeeds(teams, [], [], [], [], [], [])
    expect(seeds).toHaveLength(4)
  })
})
