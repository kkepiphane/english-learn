import { describe, it, expect } from 'vitest'
import { buildBites, MIN_FINAL_QUIZ, type DeckCard } from './lessonDeck'
import { LESSONS } from '../content'

const items = (cards: DeckCard[]) =>
  cards.flatMap((c) => (c.kind === 'hook' || c.kind === 'exercise' ? [c.item.id] : c.kind === 'quiz' ? c.items.map((i) => i.id) : []))

describe('lesson deck', () => {
  it.each(LESSONS.map((l) => [l.id, l] as const))('%s: every item and section appears exactly once', (_, lesson) => {
    const bites = buildBites(lesson)
    const cards = bites.flatMap((b) => b.cards)
    const ids = items(cards)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(ids)).toEqual(new Set([...lesson.practice, ...lesson.quiz].map((i) => i.id)))
    expect(cards.filter((c) => c.kind === 'explain')).toHaveLength(lesson.sections.length)
    expect(cards.filter((c) => c.kind === 'word')).toHaveLength(lesson.vocab.length)
  })

  it.each(LESSONS.map((l) => [l.id, l] as const))('%s: starts with action, ends with a real quiz, short bites', (_, lesson) => {
    const bites = buildBites(lesson)
    expect(bites[0].cards[0].kind).toBe('hook')
    const last = bites[bites.length - 1].cards[0]
    expect(last.kind).toBe('quiz')
    if (last.kind === 'quiz') expect(last.items.length).toBeGreaterThanOrEqual(Math.min(MIN_FINAL_QUIZ, lesson.quiz.length))
    for (const b of bites) expect(b.minutes).toBeLessThanOrEqual(8)
  })
})
