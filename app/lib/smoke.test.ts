// Phase 0 smoke test — confirms the Vitest harness runs.
// Replaced by real scoring/type tests in Phase 1.
import { describe, it, expect } from 'vitest'

describe('vitest harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
