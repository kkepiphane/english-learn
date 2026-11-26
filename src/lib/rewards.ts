import type { Assessment, Card, LessonProgress, StudySession, WritingSubmission } from '../db/db'
import { today } from '../db/db'
import { LEVELS, type Lesson, type Level, type VocabItem } from '../content/types'
import { streakInfo, xpLevel } from './stats'

/** Everything badges are computed from. Badges are derived, never stored, so they can't drift from real data. */
export interface RewardData {
  sessions: StudySession[]
  progress: LessonProgress[]
  cards: Card[]
  writings: WritingSubmission[]
  assessments: Assessment[]
  recordings: number
  /** Unit tests passed (optional: older callers don't track them). */
  unitTests?: number
  /** Spaced lesson reviews completed. */
  reviews?: number
}

export type BadgeGroup = 'streak' | 'level' | 'learning' | 'skills'

export interface Badge {
  id: string
  icon: string
  title: string
  desc: string
  group: BadgeGroup
  /** Current value and target, for the progress hint on locked badges. */
  value: number
  target: number
  /** How many times it was won (streak badges can be won again after a reset). */
  times?: number
}

/** Longest streak ever (a broken streak keeps its record). */
export const bestStreak = (sessions: StudySession[]) => streakInfo(sessions).best

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365]
const STREAK_ICONS = ['🔥', '⚡', '🌟', '👑', '💎', '🚀', '🏅', '🌍']
const LEVEL_ICONS: Record<Level, string> = { A1: '🎯', A2: '🥉', B1: '🥈', B2: '🥇', C1: '🏆' }

/** Highest level proven by a passed checkpoint or by the placement test. */
function provenLevel(assessments: Assessment[]): number {
  let best = -1
  for (const a of assessments) {
    const l = a.kind === 'checkpoint' ? (a.passed ? a.targetLevel : undefined) : a.overall === 'pre-A2' ? undefined : a.overall
    if (l) best = Math.max(best, LEVELS.indexOf(l))
  }
  return best
}

export function badges(d: RewardData): Badge[] {
  const st = streakInfo(d.sessions)
  const streak = st.best
  const lessons = d.progress.filter((p) => p.status === 'completed').length
  const perfect = d.progress.filter((p) => p.bestScore === 100).length
  const xp = xpLevel(d.sessions.reduce((a, s) => a + s.xp, 0)).lvl
  const proven = provenLevel(d.assessments)
  const placement = d.assessments.some((a) => a.kind === 'placement') ? 1 : 0
  const B = (group: BadgeGroup) => (id: string, icon: string, title: string, desc: string, value: number, target: number): Badge => ({ id, icon, title, desc, group, value: Math.min(value, target), target })
  const S = B('streak'), Lv = B('level'), Le = B('learning'), Sk = B('skills')
  return [
    ...STREAK_MILESTONES.map((n, i) => ({ ...S(`streak-${n}`, STREAK_ICONS[i], `${n}-day streak`, `Study ${n} days in a row`, Math.max(streak, st.current), n), times: st.runs.filter((r) => r >= n).length })),
    ...LEVELS.map((l, i) => Lv(`level-${l}`, LEVEL_ICONS[l], `${l} achieved`, `Prove your ${l} level (checkpoint or level test)`, proven >= i ? 1 : 0, 1)),
    Le('placement', '🧭', 'Explorer', 'Take the level test', placement, 1),
    Le('lesson-1', '🌱', 'First step', 'Complete your first lesson', lessons, 1),
    Le('lesson-5', '📚', 'Bookworm', 'Complete 5 lessons', lessons, 5),
    Le('lesson-15', '🎓', 'Scholar', 'Complete 15 lessons', lessons, 15),
    Le('lesson-30', '📖', 'Dedicated', 'Complete 30 lessons', lessons, 30),
    Le('lesson-60', '🏛️', 'Master learner', 'Complete 60 lessons', lessons, 60),
    Le('perfect', '💯', 'Perfectionist', 'Score 100 % on a lesson quiz', perfect, 1),
    Le('unit-1', '🛡️', 'Unit cleared', 'Pass a unit test', d.unitTests ?? 0, 1),
    Le('unit-10', '🏰', 'Fortress', 'Pass 10 unit tests', d.unitTests ?? 0, 10),
    Le('review-1', '🔁', 'Memory keeper', 'Complete a spaced review', d.reviews ?? 0, 1),
    Le('review-20', '🧠', 'Iron memory', 'Complete 20 spaced reviews', d.reviews ?? 0, 20),
    Sk('words-20', '🃏', 'Collector', 'Save 20 words to your flashcards', d.cards.length, 20),
    Sk('words-100', '📇', 'Word hoarder', 'Save 100 words to your flashcards', d.cards.length, 100),
    Sk('words-300', '🗝️', 'Lexicon', 'Save 300 words to your flashcards', d.cards.length, 300),
    Sk('writer', '✍️', 'Writer', 'Submit 3 writing tasks', d.writings.length, 3),
    Sk('speaker', '🎙️', 'Brave voice', 'Record yourself speaking', d.recordings, 1),
    Sk('xp-5', '⭐', 'Rising star', 'Reach XP level 5', xp, 5),
    Sk('xp-10', '🌠', 'Shooting star', 'Reach XP level 10', xp, 10),
    Sk('xp-20', '☀️', 'Supernova', 'Reach XP level 20', xp, 20),
  ]
}

/** Next streak milestone to aim for (or undefined after the last one). */
export const nextStreakMilestone = (streak: number) => STREAK_MILESTONES.find((n) => n > streak)

export const earned = (bs: Badge[]) => bs.filter((b) => b.value >= b.target)

/** Stars for a lesson from its best quiz score. */
export const stars = (score: number) => (score >= 90 ? 3 : score >= 70 ? 2 : score > 0 ? 1 : 0)

/** Monday→Sunday of the current week with study status, for the streak dots. */
export function weekDots(sessions: StudySession[], now = new Date(), frozen: Set<string> = streakInfo(sessions, now).frozenDays) {
  const active = new Set(sessions.filter((s) => s.seconds >= 60).map((s) => s.day))
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const t = today(now)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d)
    day.setDate(d.getDate() + i)
    const k = today(day)
    return { day: k, label: day.toLocaleDateString('en', { weekday: 'narrow' }), done: active.has(k), frozen: frozen.has(k), isToday: k === t, future: k > t }
  })
}

/** The same word all day, a different one each day, taken from the lessons of the learner's level. */
export function wordOfTheDay(lessons: Lesson[], now = new Date()): VocabItem | undefined {
  const words = lessons.flatMap((l) => l.vocab)
  if (!words.length) return undefined
  const k = today(now)
  let h = 0
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return words[h % words.length]
}

export const CHEST_XP = 150
