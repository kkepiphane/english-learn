import { db, type LessonProgress } from '../db/db'
import { getLesson } from '../content'
import type { Exercise, Lesson } from '../content/types'
import { shuffle } from './exercise'
import { addXp } from './repo'

/**
 * Spaced lesson reviews: after a lesson is completed, it comes back for a short quiz
 * 1 week, 2 weeks and 1 month later (counted from the day it was first completed).
 */
export const REVIEW_DAYS = [7, 14, 30]
export const REVIEW_LABELS = ['1-week review', '2-week review', '1-month review']
export const REVIEW_ITEMS = 6
export const REVIEW_XP = 15
const DAY = 86_400_000

export interface ReviewState {
  /** When the lesson was first completed. */
  base: number
  /** Number of reviews already done (0 to 3). */
  stage: number
}

export const reviewKey = (lessonId: string) => `review.${lessonId}`

export interface DueReview {
  lesson: Lesson
  stage: number
  due: number
}

/** Lessons whose next review date has passed, oldest first. Lessons completed before this feature start from their last update. */
export function dueReviews(progress: LessonProgress[], states: Map<string, ReviewState>, now = Date.now()): DueReview[] {
  const out: DueReview[] = []
  for (const p of progress) {
    if (p.status !== 'completed') continue
    const lesson = getLesson(p.lessonId)
    if (!lesson) continue
    const st = states.get(p.lessonId) ?? { base: p.updatedAt, stage: 0 }
    if (st.stage >= REVIEW_DAYS.length) continue
    const due = st.base + REVIEW_DAYS[st.stage] * DAY
    if (due <= now) out.push({ lesson, stage: st.stage, due })
  }
  return out.sort((a, b) => a.due - b.due)
}

/** Next upcoming review (not yet due), to show "next review in N days". */
export function nextReview(progress: LessonProgress[], states: Map<string, ReviewState>, now = Date.now()) {
  let best: { lesson: Lesson; due: number } | undefined
  for (const p of progress) {
    if (p.status !== 'completed') continue
    const st = states.get(p.lessonId) ?? { base: p.updatedAt, stage: 0 }
    if (st.stage >= REVIEW_DAYS.length) continue
    const due = st.base + REVIEW_DAYS[st.stage] * DAY
    const lesson = getLesson(p.lessonId)
    if (lesson && due > now && (!best || due < best.due)) best = { lesson, due }
  }
  return best
}

export const reviewItems = (lesson: Lesson, seed?: number): Exercise[] => shuffle([...lesson.quiz, ...lesson.practice], seed).slice(0, REVIEW_ITEMS)

export async function loadReviewStates() {
  const rows = await db.kv.where('key').startsWith('review.').toArray()
  return new Map(rows.map((r) => [r.key.slice('review.'.length), r.value as ReviewState]))
}

/** Marks the current review as done (moves to the next interval) and gives XP. */
export async function completeReview(lessonId: string, fallbackBase: number) {
  const key = reviewKey(lessonId)
  const st = ((await db.kv.get(key))?.value as ReviewState | undefined) ?? { base: fallbackBase, stage: 0 }
  await db.kv.put({ key, value: { ...st, stage: Math.min(st.stage + 1, REVIEW_DAYS.length) } satisfies ReviewState })
  await addXp(REVIEW_XP)
}

/** Total reviews done, for badges. */
export const reviewsDone = (states: Map<string, ReviewState>) => [...states.values()].reduce((a, s) => a + s.stage, 0)
