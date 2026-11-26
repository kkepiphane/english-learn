import { describe, it, expect } from 'vitest'
import { UNITS } from '../content'
import { saveUnitTest, unitTestItems, UNIT_TEST_MAX } from './unitTest'

describe('unit tests', () => {
  it('every unit has a test of 4 to 12 questions', () => {
    for (const u of UNITS) {
      const n = unitTestItems(u.id, 1).length
      expect(n, u.id).toBeGreaterThanOrEqual(4)
      expect(n, u.id).toBeLessThanOrEqual(UNIT_TEST_MAX)
    }
  })
  it('gives XP only on the first pass', async () => {
    expect(await saveUnitTest('t-unit', 50)).toBe(false)
    expect(await saveUnitTest('t-unit', 80)).toBe(true)
    expect(await saveUnitTest('t-unit', 90)).toBe(false)
  })
})
