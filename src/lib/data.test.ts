import { describe, it, expect, beforeEach } from 'vitest'
import { EnglishPathDB } from '../db/db'
import { buildBackup, restoreBackup, validateBackup } from './backup'
import { LESSONS, UNITS, READINGS, LISTENINGS, PLACEMENT, WRITING_PROMPTS, BASICS, checkpointItems } from '../content'
import type { Exercise } from '../content/types'
import { MIN_ITEMS_PER_LEVEL } from './scoring'

describe('content integrity', () => {
  const allItems: Exercise[] = [
    ...LESSONS.flatMap((l) => [...l.practice, ...l.quiz]),
    ...READINGS.flatMap((r) => r.questions),
    ...LISTENINGS.flatMap((l) => l.questions),
    ...PLACEMENT.map((p) => p.item),
    ...BASICS.flatMap((b) => b.items),
  ]
  it('every exercise is gradable and explained', () => {
    for (const ex of allItems) {
      expect(ex.explanation.length, ex.id).toBeGreaterThan(5)
      if (ex.type === 'mcq') {
        expect(ex.answer, ex.id).toBeGreaterThanOrEqual(0)
        expect(ex.answer, ex.id).toBeLessThan(ex.options.length)
        expect(new Set(ex.options).size, `${ex.id} duplicate options`).toBe(ex.options.length)
      }
      if (ex.type === 'gap') expect(ex.accepted.length, ex.id).toBeGreaterThan(0)
      if (ex.type === 'order') expect(ex.words.map((w) => w.toLowerCase()).sort().join(' '), ex.id).toBe(ex.answer.toLowerCase().split(' ').sort().join(' '))
    }
  })
  it('exercise ids are unique', () => {
    const ids = [...LESSONS.flatMap((l) => [...l.practice, ...l.quiz]), ...READINGS.flatMap((r) => r.questions), ...LISTENINGS.flatMap((l) => l.questions), ...BASICS.flatMap((b) => b.items)].map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('every unit references existing lessons, every lesson has a quiz', () => {
    for (const u of UNITS) for (const id of u.lessonIds) expect(LESSONS.find((l) => l.id === id), id).toBeTruthy()
    for (const l of LESSONS) expect(l.quiz.length, l.id).toBeGreaterThanOrEqual(4)
  })
  it('vocabulary entries are complete (definition, translation, IPA, example, context)', () => {
    for (const v of LESSONS.flatMap((l) => l.vocab)) {
      expect(v.ipa, v.id).toMatch(/^\/.+\/$/)
      expect(v.definition && v.fr && v.example && v.context, v.id).toBeTruthy()
    }
  })
  it('placement has enough evidence per level to be scored', () => {
    for (const lvl of ['A2', 'B1', 'B2'] as const) expect(PLACEMENT.filter((p) => p.level === lvl).length).toBeGreaterThanOrEqual(MIN_ITEMS_PER_LEVEL)
  })
  it('checkpoints cover four skills at every level', () => {
    for (const lvl of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) expect(new Set(checkpointItems(lvl).map((c) => c.skill)).size).toBe(4)
  })
  it('A1 sheets are short and have enough sprint items', () => {
    for (const b of BASICS) {
      expect(b.points.length, b.id).toBeLessThanOrEqual(4)
      expect(b.items.length, b.id).toBeGreaterThanOrEqual(8)
      expect(b.items.every((i) => i.type !== 'order'), `${b.id}: sprints need fast item types`).toBe(true)
    }
  })
  it('writing prompts have model answers within the word range', () => {
    for (const w of WRITING_PROMPTS) {
      const n = w.modelAnswer.match(/[A-Za-z']+/g)!.length
      expect(n, w.id).toBeGreaterThanOrEqual(w.minWords)
      expect(n, w.id).toBeLessThanOrEqual(w.maxWords + 20)
    }
  })
})

describe('backup export / import', () => {
  let a: EnglishPathDB, b: EnglishPathDB
  beforeEach(async () => {
    a = new EnglishPathDB('test-a-' + Math.random())
    b = new EnglishPathDB('test-b-' + Math.random())
    const now = Date.now()
    await a.profile.put({ id: 'me', name: 'Epi', nativeLanguage: 'fr', goalLevel: 'B2', exam: 'ielts', dailyGoalMin: 20, currentLevel: 'A2', skillLevels: {}, theme: 'system', uiFrench: true, createdAt: now, updatedAt: now })
    await a.attempts.bulkAdd([1, 2, 3].map((i) => ({ uuid: 'u' + i, at: now, skill: 'grammar' as const, level: 'A2' as const, source: 'quiz' as const, refId: 'r', itemId: 'i' + i, correct: true })))
    await a.kv.bulkPut([{ key: 'placement.done', value: now }, { key: 'secret.ai.accessToken', value: 'TOP-SECRET' }])
  })

  it('round-trips data and never exports secrets', async () => {
    const backup = JSON.parse(JSON.stringify(await buildBackup(a, { includeAudio: false })))
    expect(JSON.stringify(backup)).not.toContain('TOP-SECRET')
    await restoreBackup(backup, 'replace', b)
    expect((await b.profile.get('me'))?.name).toBe('Epi')
    expect(await b.attempts.count()).toBe(3)
  })
  it('merge does not duplicate history', async () => {
    const backup = JSON.parse(JSON.stringify(await buildBackup(a, { includeAudio: false })))
    await restoreBackup(backup, 'merge', a)
    await restoreBackup(backup, 'merge', a)
    expect(await a.attempts.count()).toBe(3)
  })
  it('merge keeps the newer profile', async () => {
    const backup = JSON.parse(JSON.stringify(await buildBackup(a, { includeAudio: false })))
    backup.data.profile[0].updatedAt = 1
    backup.data.profile[0].name = 'Old'
    await restoreBackup(backup, 'merge', a)
    expect((await a.profile.get('me'))?.name).toBe('Epi')
  })
  it('rejects foreign files', () => {
    expect(() => validateBackup({ hello: 'world' })).toThrow(/not an English Path backup/)
  })
})
