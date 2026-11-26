import type { Attempt, StudySession } from '../db/db'
import { today } from '../db/db'

const DAY = 86_400_000

const dayNum = (k: string) => Math.round(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / DAY)
const dayKey = (n: number) => new Date(n * DAY).toISOString().slice(0, 10)

/**
 * Streak freezes: missed days are forgiven only once the streak is long enough, and never more than this
 * for a whole streak. From 7 days: 1 frozen day. From 50 days: 3 frozen days in total.
 */
export const freezeAllowance = (run: number) => (run >= 50 ? 3 : run >= 7 ? 1 : 0)

export interface StreakInfo {
  /** Current streak (0 when broken). Frozen days don't count as study days. */
  current: number
  /** Longest streak ever. */
  best: number
  freezesUsed: number
  freezesLeft: number
  /** Missed days covered by a freeze in the current streak (YYYY-MM-DD). */
  frozenDays: Set<string>
  /** Length of every streak, past and current: a badge can be won again after a reset. */
  runs: number[]
}

/**
 * A study day = at least 1 minute of study. Not having studied yet today never breaks the streak.
 * When the gap is too long for the freezes left, the streak restarts from zero (badges are kept).
 */
export function streakInfo(sessions: StudySession[], now = new Date()): StreakInfo {
  const t = dayNum(today(now))
  const days = [...new Set(sessions.filter((s) => s.seconds >= 60).map((s) => s.day))].map(dayNum).filter((n) => n <= t).sort((a, b) => a - b)
  const runs: number[] = []
  let run = 0, used = 0, frozen: number[] = [], prev: number | null = null
  for (const n of days) {
    const gap = prev === null ? 0 : n - prev - 1
    if (prev === null || gap === 0) run++
    else if (used + gap <= freezeAllowance(run)) {
      for (let k = prev + 1; k < n; k++) frozen.push(k)
      used += gap
      run++
    } else {
      runs.push(run)
      run = 1
      used = 0
      frozen = []
    }
    prev = n
  }
  let current = 0
  if (prev !== null) {
    const missed = t - prev - 1 // days missed up to yesterday; today can still be studied
    if (missed <= 0) current = run
    else if (used + missed <= freezeAllowance(run)) {
      for (let k = prev + 1; k < t; k++) frozen.push(k)
      used += missed
      current = run
    }
    runs.push(run)
    if (!current) frozen = []
  }
  return {
    current,
    best: Math.max(0, ...runs),
    freezesUsed: current ? used : 0,
    freezesLeft: current ? Math.max(0, freezeAllowance(current) - used) : 0,
    frozenDays: new Set(frozen.map(dayKey)),
    runs,
  }
}

export const computeStreak = (sessions: StudySession[], now = new Date()) => streakInfo(sessions, now).current

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

export const XP = { correct: 5, biteDone: 10, lessonDone: 50, readingDone: 30, listeningDone: 30, writingDone: 40, cardReview: 2, placementDone: 100 }

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
