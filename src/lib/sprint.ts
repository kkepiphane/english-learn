import { db } from '../db/db'
import { BASICS, UNITS, getLesson, lessonsFor } from '../content'
import { LEVELS, type Exercise, type Lesson, type Level } from '../content/types'
import { shuffle } from './exercise'

/**
 * Timed sprints: answer as many as you can before time runs out, racing your best run (the "ghost").
 * Kinds, by id: A1 sheet ('a1-be'), A1 mix ('mix'), whole level ('level-B1'), grammar or vocabulary
 * of a level ('gram-B1', 'vocab-B1') and one unit ('unit-b1-u3').
 */
export const SPRINT_SECONDS = { sheet: 60, mix: 90, level: 90, skill: 60, unit: 60 }
export const MIX_ID = 'mix'
export const levelSprintId = (l: Level) => `level-${l}`
export const skillSprintId = (l: Level, s: 'gram' | 'vocab') => `${s}-${l}`
export const unitSprintId = (unitId: string) => `unit-${unitId}`

/** Word ordering is too slow for a sprint. */
const fast = (items: Exercise[]) => items.filter((i) => i.type !== 'order')
const lessonItems = (ls: Lesson[]) => fast(ls.flatMap((l) => [...l.practice, ...l.quiz]))

export interface SprintInfo {
  title: string
  seconds: number
  /** Level tab to go back to. */
  level: Level
  pool: Exercise[]
}

export function sprintInfo(id: string): SprintInfo | undefined {
  if (id === MIX_ID) return { title: 'A1 mixed sprint', seconds: SPRINT_SECONDS.mix, level: 'A1', pool: BASICS.flatMap((b) => b.items) }
  const sheet = BASICS.find((b) => b.id === id)
  if (sheet) return { title: sheet.title, seconds: SPRINT_SECONDS.sheet, level: 'A1', pool: sheet.items }
  for (const l of LEVELS) {
    if (id === levelSprintId(l)) return { title: `${l} sprint`, seconds: SPRINT_SECONDS.level, level: l, pool: lessonItems(lessonsFor(l)) }
    if (id === skillSprintId(l, 'gram')) return { title: `${l} grammar sprint`, seconds: SPRINT_SECONDS.skill, level: l, pool: lessonItems(lessonsFor(l).filter((x) => x.category === 'grammar')) }
    if (id === skillSprintId(l, 'vocab')) return { title: `${l} vocabulary sprint`, seconds: SPRINT_SECONDS.skill, level: l, pool: lessonItems(lessonsFor(l).filter((x) => x.category !== 'grammar')) }
  }
  const unit = UNITS.find((u) => id === unitSprintId(u.id))
  if (unit) return { title: `${unit.title} sprint`, seconds: SPRINT_SECONDS.unit, level: unit.level, pool: lessonItems(unit.lessonIds.map((x) => getLesson(x)!)) }
  return undefined
}

/** The level of a level sprint id ('level-B2' → 'B2'), or undefined. */
export const sprintLevel = (id: string) => LEVELS.find((l) => id === levelSprintId(l))
export const sprintSeconds = (id: string) => sprintInfo(id)?.seconds ?? SPRINT_SECONDS.sheet

export interface SprintRecord {
  best: number
  /** Milliseconds from the start at which each correct answer of the best run was given. */
  times: number[]
}

export const sprintKey = (id: string) => `sprint.${id}`

export const sprintItems = (id: string, seed?: number): Exercise[] => shuffle(sprintInfo(id)?.pool ?? [], seed)

/** How many correct answers the ghost had after `ms` milliseconds. */
export const ghostAt = (rec: SprintRecord | undefined, ms: number) => (rec ? rec.times.filter((t) => t <= ms).length : 0)

export async function getRecord(id: string) {
  return (await db.kv.get(sprintKey(id)))?.value as SprintRecord | undefined
}

/** Saves the run if it beats the record. Returns true for a new record. */
export async function saveRun(id: string, times: number[]) {
  const prev = await getRecord(id)
  if (prev && times.length <= prev.best) return false
  await db.kv.put({ key: sprintKey(id), value: { best: times.length, times } satisfies SprintRecord })
  return times.length > 0
}
