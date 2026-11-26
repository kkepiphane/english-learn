import { db } from '../db/db'
import { BASICS } from '../content'
import type { Exercise } from '../content/types'
import { shuffle } from './exercise'

/** Timed sprint on A1 basics: answer as many as you can before time runs out, racing your best run (the "ghost"). */
export const SPRINT_SECONDS = { sheet: 60, mix: 90 }
export const MIX_ID = 'mix'

export interface SprintRecord {
  best: number
  /** Milliseconds from the start at which each correct answer of the best run was given. */
  times: number[]
}

export const sprintKey = (id: string) => `sprint.${id}`

export function sprintItems(id: string, seed?: number): Exercise[] {
  const pool = id === MIX_ID ? BASICS.flatMap((b) => b.items) : BASICS.find((b) => b.id === id)?.items ?? []
  return shuffle(pool, seed)
}

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
