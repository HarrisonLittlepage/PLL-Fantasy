import { describe, it, expect } from 'vitest'
import {
  shortName,
  getSlotLabel,
  getSlotPosition,
  ELIGIBLE_POSITIONS,
  SLOT_LABELS,
  SLOT_POSITIONS,
} from './index'

describe('shortName', () => {
  it('abbreviates first name to an initial', () => {
    expect(shortName('Jeff Teat')).toBe('J. Teat')
  })

  it('handles multi-word last names', () => {
    expect(shortName('Connor Shellenberger')).toBe('C. Shellenberger')
    expect(shortName('Tom Van Ryn')).toBe('T. Van Ryn')
  })

  it('returns single-word names unchanged', () => {
    expect(shortName('Prume')).toBe('Prume')
  })

  it('returns empty string unchanged', () => {
    expect(shortName('')).toBe('')
  })

  it('does not abbreviate when the last token is the G or FO marker', () => {
    expect(shortName('Some Player G')).toBe('Some Player G')
    expect(shortName('Some Player FO')).toBe('Some Player FO')
  })

  it('trims surrounding whitespace before abbreviating', () => {
    expect(shortName('  Jeff Teat  ')).toBe('J. Teat')
  })
})

describe('getSlotLabel', () => {
  it('labels the 10 starting slots', () => {
    expect(getSlotLabel(0)).toBe('Faceoff')
    expect(getSlotLabel(7)).toBe('Goalie')
    expect(getSlotLabel(8)).toBe('Flex')
    expect(getSlotLabel(9)).toBe('Flex')
  })

  it('labels any slot index >= 10 as Bench', () => {
    expect(getSlotLabel(10)).toBe('Bench')
    expect(getSlotLabel(13)).toBe('Bench')
  })

  it('stays in sync with the exported SLOT_LABELS array', () => {
    expect(SLOT_LABELS).toHaveLength(10)
    SLOT_LABELS.forEach((label, i) => expect(getSlotLabel(i)).toBe(label))
  })
})

describe('getSlotPosition', () => {
  it('maps the 10 starting slots to positions', () => {
    expect(getSlotPosition(0)).toBe('FO')
    expect(getSlotPosition(7)).toBe('G')
    expect(getSlotPosition(8)).toBe('FLEX')
  })

  it('maps any slot index >= 10 to BN', () => {
    expect(getSlotPosition(10)).toBe('BN')
    expect(getSlotPosition(13)).toBe('BN')
  })

  it('stays in sync with the exported SLOT_POSITIONS array', () => {
    expect(SLOT_POSITIONS).toHaveLength(10)
    SLOT_POSITIONS.forEach((pos, i) => expect(getSlotPosition(i)).toBe(pos))
  })
})

describe('ELIGIBLE_POSITIONS', () => {
  it('allows SSDM to fill midfield and defense but not pure attack', () => {
    expect(ELIGIBLE_POSITIONS.M).toContain('SSDM')
    expect(ELIGIBLE_POSITIONS.D).toContain('SSDM')
    expect(ELIGIBLE_POSITIONS.A).not.toContain('SSDM')
  })

  it('allows LSM at defense but not attack/midfield', () => {
    expect(ELIGIBLE_POSITIONS.D).toContain('LSM')
    expect(ELIGIBLE_POSITIONS.M).not.toContain('LSM')
    expect(ELIGIBLE_POSITIONS.A).not.toContain('LSM')
  })

  it('FLEX accepts every field position but not goalie', () => {
    expect(ELIGIBLE_POSITIONS.FLEX).toContain('A')
    expect(ELIGIBLE_POSITIONS.FLEX).toContain('FO')
    expect(ELIGIBLE_POSITIONS.FLEX).not.toContain('G')
  })

  it('bench (BN) accepts every position including goalie', () => {
    for (const pos of ['A', 'M', 'D', 'SSDM', 'LSM', 'FO', 'G']) {
      expect(ELIGIBLE_POSITIONS.BN).toContain(pos)
    }
  })
})
