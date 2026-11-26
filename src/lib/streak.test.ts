import { describe, it, expect } from 'vitest'
import { streakInfo } from './stats'
import { badges } from './rewards'
import type { StudySession } from '../db/db'

const DAY = 86_400_000
const key = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * DAY).toISOString().slice(0, 10)
/** Sessions on the given day numbers (day 0 = 1 Jan 2026). */
const on = (...days: number[]): StudySession[] => days.map((d) => ({ day: key(d), seconds: 600, xp: 10 }))
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const at = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * DAY + 12 * 3600_000)

describe('streak freezes', () => {
  it('below 7 days, one missed day resets the streak', () => {
    const s = streakInfo(on(...range(0, 4), 6), at(6))
    expect(s.current).toBe(1)
    expect(s.best).toBe(5)
  })
  it('from 7 days, one missed day is frozen, not two', () => {
    expect(streakInfo(on(...range(0, 6), 8), at(8)).current).toBe(8)
    expect(streakInfo(on(...range(0, 6), 8), at(8)).frozenDays.has(key(7))).toBe(true)
    expect(streakInfo(on(...range(0, 6), 9), at(9)).current).toBe(1)
  })
  it('only one freeze in total between 7 and 49 days', () => {
    expect(streakInfo(on(...range(0, 6), ...range(8, 12), ...range(14, 15)), at(15)).current).toBe(2)
  })
  it('from 50 days, up to 3 frozen days in total and no more', () => {
    const fifty = range(0, 49)
    expect(streakInfo(on(...fifty, 53), at(53)).current).toBe(51)
    expect(streakInfo(on(...fifty, 54), at(54)).current).toBe(1)
    expect(streakInfo(on(...fifty, 52, 55), at(55)).current).toBe(1) // 2 + 2 missed = 4 > 3
  })
  it('one more freeze every 30 days of streak, never more than the cap', () => {
    // 7 days, a frozen day, then study up to day 30 of the streak: a new freeze covers another missed day.
    expect(streakInfo(on(...range(0, 6), ...range(8, 30), 32), at(32)).current).toBe(31)
    // Without reaching 30 days, the second missed day breaks the streak.
    expect(streakInfo(on(...range(0, 6), ...range(8, 28), 30), at(30)).current).toBe(1)
    // From 50 days you hold at most 3 freezes, even after 60 days.
    const s = streakInfo(on(...range(0, 59)), at(59))
    expect(s.freezesLeft).toBe(3)
  })
  it('a missed yesterday is covered while today is still open', () => {
    const s = streakInfo(on(...range(0, 9)), at(11))
    expect(s.current).toBe(10)
    expect(s.freezesLeft).toBe(0)
  })
  it('badges are kept after a reset and can be won again', () => {
    const sessions = on(...range(0, 6), ...range(20, 26))
    const b = badges({ sessions, progress: [], cards: [], writings: [], assessments: [], recordings: 0 }).find((x) => x.id === 'streak-7')!
    expect(b.value).toBe(7)
    expect(b.times).toBe(2)
  })
})
