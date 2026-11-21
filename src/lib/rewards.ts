import type { Assessment, Card, LessonProgress, StudySession, WritingSubmission } from '../db/db'
import { today } from '../db/db'
import type { Lesson, VocabItem } from '../content/types'
import { computeStreak, xpLevel } from './stats'

/** Everything badges are computed from. Badges are derived, never stored, so they can't drift from real data. */
export interface RewardData {
  sessions: StudySession[]
  progress: LessonProgress[]
  cards: Card[]
  writings: WritingSubmission[]
  assessments: Assessment[]
  recordings: number
}

export interface Badge {
  id: string
  icon: string
  title: string
  desc: string
  /** Current value and target, for the progress hint on locked badges. */
  value: number
  target: number
}

/** Longest run of consecutive study days ever (a broken streak keeps its record). */
export function bestStreak(sessions: StudySession[]): number {
  const days = [...new Set(sessions.filter((s) => s.seconds >= 60).map((s) => s.day))].sort()
  let best = 0, run = 0, prev = ''
  for (const d of days) {
    const p = new Date(d + 'T12:00:00')
    p.setDate(p.getDate() - 1)
    run = prev === today(p) ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

export function badges(d: RewardData): Badge[] {
  const streak = Math.max(bestStreak(d.sessions), computeStreak(d.sessions))
  const lessons = d.progress.filter((p) => p.status === 'completed').length
  const perfect = d.progress.filter((p) => p.bestScore === 100).length
  const xp = xpLevel(d.sessions.reduce((a, s) => a + s.xp, 0)).lvl
  const checkpoints = d.assessments.filter((a) => a.kind === 'checkpoint' && a.passed).length
  const placement = d.assessments.some((a) => a.kind === 'placement') ? 1 : 0
  const B = (id: string, icon: string, title: string, desc: string, value: number, target: number): Badge => ({ id, icon, title, desc, value: Math.min(value, target), target })
  return [
    B('placement', '🧭', 'Explorer', 'Take the level test', placement, 1),
    B('lesson-1', '🌱', 'First step', 'Complete your first lesson', lessons, 1),
    B('lesson-5', '📚', 'Bookworm', 'Complete 5 lessons', lessons, 5),
    B('lesson-15', '🎓', 'Scholar', 'Complete 15 lessons', lessons, 15),
    B('perfect', '💯', 'Perfectionist', 'Score 100 % on a lesson quiz', perfect, 1),
    B('streak-3', '🔥', 'On fire', 'Study 3 days in a row', streak, 3),
    B('streak-7', '⚡', 'Unstoppable', 'Study 7 days in a row', streak, 7),
    B('streak-30', '👑', 'Habit master', 'Study 30 days in a row', streak, 30),
    B('words-20', '🃏', 'Collector', 'Save 20 words to your flashcards', d.cards.length, 20),
    B('words-100', '🧠', 'Word hoarder', 'Save 100 words to your flashcards', d.cards.length, 100),
    B('writer', '✍️', 'Writer', 'Submit 3 writing tasks', d.writings.length, 3),
    B('speaker', '🎙️', 'Brave voice', 'Record yourself speaking', d.recordings, 1),
    B('xp-5', '⭐', 'Rising star', 'Reach XP level 5', xp, 5),
    B('checkpoint', '🏆', 'Level up', 'Pass a level checkpoint', checkpoints, 1),
  ]
}

export const earned = (bs: Badge[]) => bs.filter((b) => b.value >= b.target)

/** Stars for a lesson from its best quiz score. */
export const stars = (score: number) => (score >= 90 ? 3 : score >= 70 ? 2 : score > 0 ? 1 : 0)

/** Monday→Sunday of the current week with study status, for the streak dots. */
export function weekDots(sessions: StudySession[], now = new Date()) {
  const active = new Set(sessions.filter((s) => s.seconds >= 60).map((s) => s.day))
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const t = today(now)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d)
    day.setDate(d.getDate() + i)
    const k = today(day)
    return { day: k, label: day.toLocaleDateString('en', { weekday: 'narrow' }), done: active.has(k), isToday: k === t, future: k > t }
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
