import type { Exercise, Lesson, LessonSection, VocabItem } from '../content/types'

/**
 * Turns a lesson into short "bites" of one-idea cards, so the learner acts within seconds
 * instead of reading a long page first:
 *   bite 1  guess-first question → explanation → exercise → explanation → exercise…
 *   bite 2  remaining explanations and exercises → vocabulary flip cards
 *   bite 3  short final quiz (the score saved for the lesson)
 * Each bite takes a few minutes and can be the end of today's session.
 */
export type DeckCard =
  | { kind: 'hook'; item: Exercise }
  | { kind: 'explain'; section: LessonSection }
  | { kind: 'exercise'; item: Exercise }
  | { kind: 'word'; vocab: VocabItem }
  | { kind: 'quiz'; items: Exercise[] }

export interface Bite {
  title: string
  cards: DeckCard[]
  minutes: number
}

/** The final quiz always keeps at least this many items, so the lesson score stays meaningful. */
export const MIN_FINAL_QUIZ = 3

const cost = (c: DeckCard) =>
  c.kind === 'explain' ? 1.5 : c.kind === 'word' ? 0.3 : c.kind === 'quiz' ? c.items.length * 0.5 : 0.5

export const biteMinutes = (cards: DeckCard[]) => Math.max(2, Math.ceil(cards.reduce((a, c) => a + cost(c), 0)))

export function buildBites(lesson: Lesson): Bite[] {
  // Inline exercises: practice items first, then quiz items the final quiz can spare.
  const spare = Math.max(0, lesson.quiz.length - MIN_FINAL_QUIZ)
  const pool = [...lesson.practice, ...lesson.quiz.slice(0, spare)]
  const used = new Set<string>()
  const take = () => {
    const it = pool.shift()
    if (it) used.add(it.id)
    return it
  }

  const hook = take()
  const sections = lesson.sections.map((section) => {
    const cards: DeckCard[] = [{ kind: 'explain', section }]
    const ex = take()
    if (ex) cards.push({ kind: 'exercise', item: ex })
    return cards
  })
  const half = Math.ceil(sections.length / 2)
  // Leftover practice items stay in the lesson; leftover spare quiz items go back to the final quiz.
  const extraPractice = pool.filter((it) => lesson.practice.includes(it))
  extraPractice.forEach((it) => used.add(it.id))

  const first: DeckCard[] = [...(hook ? [{ kind: 'hook' as const, item: hook }] : []), ...sections.slice(0, half).flat()]
  const second: DeckCard[] = [
    ...sections.slice(half).flat(),
    ...extraPractice.map((item) => ({ kind: 'exercise' as const, item })),
    ...lesson.vocab.map((vocab) => ({ kind: 'word' as const, vocab })),
  ]
  const finalItems = lesson.quiz.filter((q) => !used.has(q.id))

  const bites: Bite[] = []
  if (first.length) bites.push({ title: 'Discover', cards: first, minutes: biteMinutes(first) })
  if (second.length) bites.push({ title: lesson.vocab.length ? 'Practise and new words' : 'Practise', cards: second, minutes: biteMinutes(second) })
  if (finalItems.length) {
    const cards: DeckCard[] = [{ kind: 'quiz', items: finalItems }]
    bites.push({ title: 'Final quiz', cards, minutes: biteMinutes(cards) })
  }
  return bites
}
