import type { Attempt, StudySession } from '../db/db'
import { today } from '../db/db'

const DAY = 86_400_000

/** Streak counts consecutive days with ≥ 1 minute of study. Today not yet studied does not break it. */
export function computeStreak(sessions: StudySession[], now = new Date()): number {
  const active = new Set(sessions.filter((s) => s.seconds >= 60).map((s) => s.day))
  let streak = 0
  const d = new Date(now)
  if (!active.has(today(d))) d.setDate(d.getDate() - 1)
  while (active.has(today(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export function lastNDays(sessions: StudySession[], n: number, now = new Date()) {
  const map = new Map(sessions.map((s) => [s.day, s]))
  const out: { day: string; label: string; minutes: number; xp: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const k = today(d)
    const s = map.get(k)
    out.push({ day: k, label: d.toLocaleDateString('en', { weekday: 'short' }), minutes: Math.round((s?.seconds ?? 0) / 60), xp: s?.xp ?? 0 })
  }
  return out
}

export function successRate(attempts: Attempt[], days?: number, now = Date.now()) {
  const rs = days ? attempts.filter((a) => a.at >= now - days * DAY) : attempts
  return { total: rs.length, rate: rs.length ? Math.round((rs.filter((a) => a.correct).length / rs.length) * 100) : 0 }
}

export const XP = { correct: 5, lessonDone: 50, readingDone: 30, listeningDone: 30, writingDone: 40, cardReview: 2, placementDone: 100 }

/** Player level from XP: each level needs 100 more XP than the previous. */
export function xpLevel(xp: number) {
  let lvl = 1, need = 200, rest = xp
  while (rest >= need) {
    rest -= need
    lvl++
    need += 100
  }
  return { lvl, into: rest, need }
}
