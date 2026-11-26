import { describe, it, expect } from 'vitest'
import { dueReviews, nextReview, reviewItems, reviewsDone, REVIEW_ITEMS, type ReviewState } from './review'
import { LESSONS } from '../content'
import type { LessonProgress } from '../db/db'

const DAY = 86_400_000
const now = new Date('2026-11-27T12:00:00').getTime()
const done = (lessonId: string, daysAgo: number): LessonProgress => ({ lessonId, status: 'completed', bestScore: 80, attempts: 1, updatedAt: now - daysAgo * DAY })

describe('spaced lesson reviews', () => {
  const id = LESSONS[0].id
  it('a lesson comes back after 1 week, 2 weeks and 1 month', () => {
    const st = (stage: number, daysAgo: number) => new Map<string, ReviewState>([[id, { base: now - daysAgo * DAY, stage }]])
    expect(dueReviews([done(id, 0)], st(0, 6), now)).toHaveLength(0)
    expect(dueReviews([done(id, 0)], st(0, 7), now)[0].stage).toBe(0)
    expect(dueReviews([done(id, 0)], st(1, 13), now)).toHaveLength(0)
    expect(dueReviews([done(id, 0)], st(1, 14), now)).toHaveLength(1)
    expect(dueReviews([done(id, 0)], st(2, 30), now)).toHaveLength(1)
    expect(dueReviews([done(id, 0)], st(3, 400), now)).toHaveLength(0)
  })
  it('lessons finished before the feature use their completion date', () => {
    expect(dueReviews([done(id, 8)], new Map(), now)).toHaveLength(1)
    expect(nextReview([done(id, 2)], new Map(), now)?.lesson.id).toBe(id)
  })
  it('a review has a few questions from the lesson', () => {
    expect(reviewItems(LESSONS[0], 1).length).toBeLessThanOrEqual(REVIEW_ITEMS)
    expect(reviewItems(LESSONS[0], 1).length).toBeGreaterThan(2)
  })
  it('counts reviews done for badges', () => {
    expect(reviewsDone(new Map([['a', { base: 0, stage: 2 }], ['b', { base: 0, stage: 1 }]]))).toBe(3)
  })
})
