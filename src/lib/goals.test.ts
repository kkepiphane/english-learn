import { describe, it, expect } from 'vitest'
import { daysLeft, dreamTitle, records, reminderGoogleUrl, reminderIcs, weekVsWeek } from './goals'
import { today } from '../db/db'

const s = (day: string, xp: number, seconds = 600) => ({ day, xp, seconds })

describe('goals', () => {
  it('counts days until the end of the target month', () => {
    const now = new Date('2026-11-25T10:00:00')
    expect(daysLeft('2026-11', now)).toBe(6) // today included
    expect(daysLeft('2026-12', now)).toBe(37)
    expect(daysLeft('2026-10', now)).toBeNull()
    expect(daysLeft(undefined, now)).toBeNull()
  })

  it('names the dream with its place', () => {
    expect(dreamTitle({ dreams: ['study'], place: 'Canada' })).toBe('Study in Canada')
    expect(dreamTitle({ dreams: ['exam'] })).toBe('Pass IELTS / TOEFL')
  })

  it('compares this week (from Monday) with last week', () => {
    const wed = new Date('2026-11-25T10:00:00') // Wednesday
    const r = weekVsWeek([s('2026-11-16', 50), s('2026-11-22', 30), s('2026-11-23', 20), s('2026-11-25', 15), s('2026-11-10', 999)], wed)
    expect(r).toEqual({ thisWeek: 35, lastWeek: 80 })
  })

  it('tracks personal records', () => {
    const r = records([s('2026-01-01', 120, 1800), s(today(), 40)])
    expect(r).toEqual({ bestDay: 120, bestMinutes: 30, todayXp: 40 })
  })

  it('builds a daily calendar reminder starting tomorrow', () => {
    const now = new Date('2026-11-25T10:00:00')
    const ics = reminderIcs('19:50', 'English time', 'https://x.test/app/', now)
    expect(ics).toContain('DTSTART:20261126T195000')
    expect(ics).toContain('DTEND:20261126T200500')
    expect(ics).toContain('RRULE:FREQ=DAILY')
    const g = new URL(reminderGoogleUrl('07:00', 'English time', 'https://x.test/', now))
    expect(g.searchParams.get('dates')).toBe('20261126T070000/20261126T071500')
    expect(g.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY')
  })
})
