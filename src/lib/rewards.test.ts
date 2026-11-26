import { describe, it, expect } from 'vitest'
import { badges, bestStreak, earned, stars, weekDots, wordOfTheDay } from './rewards'
import { weekStart, weeklyChallenges } from './recommend'
import { lessonsFor } from '../content'
import type { StudySession } from '../db/db'

const s = (day: string, seconds = 600, xp = 0): StudySession => ({ day, seconds, xp })
const empty = { sessions: [], progress: [], cards: [], writings: [], assessments: [], recordings: 0 }

describe('rewards', () => {
  it('best streak survives a break and ignores days under a minute', () => {
    expect(bestStreak([s('2026-11-01'), s('2026-11-02'), s('2026-11-03'), s('2026-11-05'), s('2026-11-06', 30)])).toBe(3)
    expect(bestStreak([])).toBe(0)
    // across a month boundary
    expect(bestStreak([s('2026-10-31'), s('2026-11-01')])).toBe(2)
  })

  it('badges are earned from real data only', () => {
    expect(earned(badges(empty))).toHaveLength(0)
    const got = earned(badges({
      ...empty,
      sessions: [s('2026-11-01'), s('2026-11-02'), s('2026-11-03')],
      progress: [{ lessonId: 'x', status: 'completed', bestScore: 100, attempts: 1, updatedAt: 0 }],
    })).map((b) => b.id)
    expect(got).toEqual(expect.arrayContaining(['lesson-1', 'perfect', 'streak-3']))
    expect(got).not.toContain('streak-7')
  })

  it('streak badges go up to 365 days and level badges follow proven levels', () => {
    const all = badges({ ...empty, assessments: [{ uuid: 'x', at: 0, kind: 'placement', overall: 'B1', perSkill: {}, perLevel: {} }] })
    expect(all.filter((b) => b.group === 'streak').map((b) => b.target)).toEqual([3, 7, 14, 30, 50, 100, 200, 365])
    const lv = Object.fromEntries(all.filter((b) => b.group === 'level').map((b) => [b.id, b.value >= b.target]))
    expect(lv).toEqual({ 'level-A1': true, 'level-A2': true, 'level-B1': true, 'level-B2': false, 'level-C1': false })
  })

  it('stars follow the quiz score', () => {
    expect([stars(0), stars(40), stars(70), stars(89), stars(90), stars(100)]).toEqual([0, 1, 2, 2, 3, 3])
  })

  it('week starts on Monday and the dots cover Monday to Sunday', () => {
    const wed = new Date('2026-11-18T10:00:00') // a Wednesday
    expect(weekStart(wed)).toBe('2026-11-16')
    expect(weekStart(new Date('2026-11-22T10:00:00'))).toBe('2026-11-16') // Sunday
    const dots = weekDots([s('2026-11-16'), s('2026-11-18')], wed)
    expect(dots.map((d) => d.done)).toEqual([true, false, true, false, false, false, false])
    expect(dots[2].isToday).toBe(true)
    expect(dots[3].future).toBe(true)
  })

  it('weekly challenges reset on Monday', () => {
    const mon = new Date('2026-11-23T09:00:00')
    const w = weeklyChallenges([s('2026-11-20'), s('2026-11-21'), s('2026-11-23')], [], [], mon)
    expect(w.find((c) => c.id === 'days')!.done).toBe(1)
  })

  it('word of the day is stable within a day', () => {
    const lessons = lessonsFor('A2')
    const a = wordOfTheDay(lessons, new Date('2026-11-18T08:00:00'))
    const b = wordOfTheDay(lessons, new Date('2026-11-18T22:00:00'))
    expect(a).toBeDefined()
    expect(a!.id).toBe(b!.id)
  })
})
