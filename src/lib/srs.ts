import type { Card } from '../db/db'

/** Grades shown to the learner. */
export type Grade = 0 | 1 | 2 | 3 // Again, Hard, Good, Easy
const DAY = 86_400_000

/**
 * SM-2 variant (Anki-like). Difficult items come back sooner; mastered items space out.
 * Pure function — easy to unit-test and identical on server if needed.
 */
export function review(card: Card, grade: Grade, now = Date.now()): Card {
  let { ease, interval, reps, lapses } = card
  if (grade === 0) {
    lapses += 1
    reps = 0
    interval = 0 // relearn in 10 minutes
    ease = Math.max(1.3, ease - 0.2)
    return { ...card, ease, interval, reps, lapses, due: now + 10 * 60_000, updatedAt: now }
  }
  const q = grade === 1 ? 3 : grade === 2 ? 4 : 5
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
  reps += 1
  if (reps === 1) interval = grade === 3 ? 3 : 1
  else if (reps === 2) interval = grade === 1 ? 3 : 6
  else interval = Math.round(interval * (grade === 1 ? 1.2 : grade === 3 ? ease * 1.3 : ease))
  return { ...card, ease, interval, reps, lapses, due: now + interval * DAY, updatedAt: now }
}

export function newCard(partial: Pick<Card, 'id' | 'front' | 'back' | 'source'> & Partial<Card>, now = Date.now()): Card {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now, updatedAt: now, ...partial }
}

/** Merge rule used by sync: the most recently reviewed version of a card wins. */
export const mergeCard = (a: Card, b: Card) => (b.updatedAt > a.updatedAt ? b : a)
