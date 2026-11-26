import { describe, it, expect } from 'vitest'
import { placeLevel, scorePlacement, scoreCheckpoint, startingLevel, type ItemResult } from './scoring'
import { review, newCard } from './srs'
import { skillMastery } from './mastery'
import { isCorrect, normalise } from './exercise'
import { analyseWriting } from './writingCheck'
import { computeStreak, xpLevel } from './stats'
import type { Attempt } from '../db/db'
import type { Level, Skill } from '../content/types'

const r = (level: Level, correct: boolean, skill: Skill = 'grammar'): ItemResult => ({ level, correct, skill })
const many = (level: Level, ok: number, ko: number) => [...Array(ok).fill(0).map(() => r(level, true)), ...Array(ko).fill(0).map(() => r(level, false))]

describe('placement scoring', () => {
  it('places pre-A2 when A2 is failed', () => expect(placeLevel(many('A2', 1, 7))).toBe('pre-A2'))
  it('places A2 when A2 passed and B1 failed', () => expect(placeLevel([...many('A2', 7, 1), ...many('B1', 2, 6)])).toBe('A2'))
  it('never places B1 if A2 is failed, even with a good B1 score (guessing protection)', () =>
    expect(placeLevel([...many('A2', 2, 6), ...many('B1', 8, 0)])).toBe('pre-A2'))
  it('requires minimum evidence per level', () => expect(placeLevel(many('A2', 2, 0))).toBe('pre-A2'))
  it('computes per-level percentages', () => {
    const res = scorePlacement([...many('A2', 6, 2), ...many('B1', 4, 4)])
    expect(res.perLevel).toEqual({ A2: 75, B1: 50 })
    expect(res.overall).toBe('A2')
  })
  it('starting level is the next level to learn', () => {
    expect(startingLevel('pre-A2')).toBe('A1')
    expect(startingLevel('A2')).toBe('B1')
  })
})

describe('checkpoint', () => {
  it('fails if a single skill is below 70 % even when the average is high', () => {
    const res = scoreCheckpoint([...Array(10).fill(r('B1', true, 'grammar')), r('B1', true, 'listening'), r('B1', false, 'listening'), r('B1', false, 'listening')])
    expect(res.overall).toBeGreaterThan(0.7)
    expect(res.passed).toBe(false)
  })
  it('passes when every skill reaches 70 %', () => {
    expect(scoreCheckpoint([r('B1', true, 'grammar'), r('B1', true, 'reading'), r('B1', true, 'listening')]).passed).toBe(true)
  })
})

describe('SM-2 spaced repetition', () => {
  const t0 = 1_700_000_000_000
  it('grows intervals for good answers', () => {
    let c = newCard({ id: 'x', front: 'a', back: 'b', source: 'test' }, t0)
    c = review(c, 2, t0)
    expect(c.interval).toBe(1)
    c = review(c, 2, t0)
    expect(c.interval).toBe(6)
    c = review(c, 2, t0)
    expect(c.interval).toBeGreaterThan(12)
  })
  it('brings failed cards back within minutes and lowers ease', () => {
    let c = newCard({ id: 'x', front: 'a', back: 'b', source: 'test' }, t0)
    c = review(review(c, 2, t0), 0, t0)
    expect(c.due - t0).toBe(10 * 60_000)
    expect(c.ease).toBeLessThan(2.5)
    expect(c.lapses).toBe(1)
  })
  it('never lets ease drop below 1.3', () => {
    let c = newCard({ id: 'x', front: 'a', back: 'b', source: 'test' }, t0)
    for (let i = 0; i < 20; i++) c = review(c, 0, t0)
    expect(c.ease).toBe(1.3)
  })
})

describe('mastery', () => {
  const att = (correct: boolean, at: number): Attempt => ({ uuid: Math.random() + '', at, skill: 'grammar', level: 'A2', source: 'quiz', refId: 'r', itemId: 'i', correct })
  const now = Date.now()
  it('is not "acquired" on thin evidence', () => {
    expect(skillMastery('grammar', [att(true, now), att(true, now)]).status).toBe('progressing')
  })
  it('is acquired with enough correct answers', () => {
    expect(skillMastery('grammar', Array(10).fill(0).map(() => att(true, now))).status).toBe('acquired')
  })
  it('flags acquired skills untouched for 2+ weeks as "review"', () => {
    expect(skillMastery('grammar', Array(10).fill(0).map(() => att(true, now - 20 * 86_400_000)), now).status).toBe('review')
  })
  it('flags insufficient skills', () => {
    expect(skillMastery('grammar', Array(10).fill(0).map((_, i) => att(i < 3, now))).status).toBe('insufficient')
  })
})

describe('answer checking', () => {
  it('normalises case, quotes and final punctuation', () => expect(normalise('  Is Sleeping. ')).toBe('is sleeping'))
  it('accepts contraction variants', () =>
    expect(isCorrect({ id: 'a', type: 'gap', prompt: '', accepted: ["isn't working"], explanation: '' }, 'is not working')).toBe(true))
  it('rejects wrong answers', () =>
    expect(isCorrect({ id: 'a', type: 'gap', prompt: '', accepted: ['went'], explanation: '' }, 'goed')).toBe(false))
})

describe('offline writing feedback', () => {
  it('detects typical French-speaker errors with explanations', () => {
    const f = analyseWriting('i am agree with you. I have 25 years and i live in Lomé since five years. The life is hard .')
    const ex = f.issues.map((i) => i.excerpt.toLowerCase())
    expect(ex).toContain('i am agree')
    expect(ex).toContain('i have 25 years')
    expect(ex.some((e) => e.includes('since five years'))).toBe(true)
    expect(f.issues.every((i) => i.why && i.whyFr)).toBe(true)
    expect(f.improved).toContain('I agree')
    expect(f.improved).toContain('I am 25 years old')
    expect(f.improved).toContain('for five years')
    expect(f.improved).toContain('Life is hard.')
  })
  it('warns about false friends', () => {
    expect(analyseWriting('Actually I work as a developer.').issues.some((i) => i.type === 'vocabulary')).toBe(true)
  })
  it('flags short texts against the task', () => {
    expect(analyseWriting('Hello. I work.', { minWords: 60 }).tips.join(' ')).toMatch(/Too short/)
  })
})

describe('streak & xp', () => {
  it('counts consecutive days and does not break on a not-yet-studied today', () => {
    const d = (n: number) => { const x = new Date(2026, 10, 20); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${`${x.getMonth() + 1}`.padStart(2, '0')}-${`${x.getDate()}`.padStart(2, '0')}` }
    const s = [1, 2, 3].map((n) => ({ day: d(n), seconds: 300, xp: 10 }))
    expect(computeStreak(s, new Date(2026, 10, 20, 9))).toBe(3)
  })
  it('xp levels', () => {
    expect(xpLevel(0).lvl).toBe(1)
    expect(xpLevel(200).lvl).toBe(2)
  })
})
