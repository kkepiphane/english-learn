import type { Attempt } from '../db/db'
import type { Skill } from '../content/types'

export type MasteryStatus = 'acquired' | 'progressing' | 'insufficient' | 'review' | 'not-started'

export interface SkillMastery {
  skill: Skill
  status: MasteryStatus
  score: number // 0–100, recency-weighted
  evidence: number
  lastAt?: number
}

const DAY = 86_400_000
export const MIN_EVIDENCE = 8
export const WINDOW = 40
export const REVIEW_AFTER_DAYS = 14

/**
 * Recency-weighted accuracy over the last WINDOW answers for a skill.
 * - not enough evidence  -> 'not-started' / 'progressing' (never 'acquired' on 3 lucky answers)
 * - ≥ 80 %               -> 'acquired'  (or 'review' if untouched for 14 days)
 * - 60–80 %              -> 'progressing'
 * - < 60 %               -> 'insufficient'
 */
export function skillMastery(skill: Skill, attempts: Attempt[], now = Date.now()): SkillMastery {
  const rs = attempts
    .filter((a) => a.skill === skill)
    .sort((a, b) => b.at - a.at)
    .slice(0, WINDOW)
  if (rs.length === 0) return { skill, status: 'not-started', score: 0, evidence: 0 }
  let num = 0, den = 0
  rs.forEach((a, i) => {
    const w = Math.pow(0.95, i) // newest answers weigh more
    num += (a.correct ? 1 : 0) * w
    den += w
  })
  const score = Math.round((num / den) * 100)
  const lastAt = rs[0].at
  let status: MasteryStatus
  if (rs.length < MIN_EVIDENCE) status = score < 60 ? 'insufficient' : 'progressing'
  else if (score >= 80) status = now - lastAt > REVIEW_AFTER_DAYS * DAY ? 'review' : 'acquired'
  else if (score >= 60) status = 'progressing'
  else status = 'insufficient'
  return { skill, status, score, evidence: rs.length, lastAt }
}

export const STATUS_LABEL: Record<MasteryStatus, string> = {
  acquired: 'Acquired',
  progressing: 'In progress',
  insufficient: 'Needs work',
  review: 'To review',
  'not-started': 'Not started',
}
export const STATUS_COLOR: Record<MasteryStatus, string> = {
  acquired: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  progressing: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300',
  insufficient: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'not-started': 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
}
