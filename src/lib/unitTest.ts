import { db } from '../db/db'
import { UNITS, getLesson } from '../content'
import type { Exercise } from '../content/types'
import { shuffle } from './exercise'
import { addXp } from './repo'

/** End-of-unit test: the unit's quiz questions, no correction until the end, 70 % to pass. */
export const UNIT_TEST_PASS = 70
export const UNIT_TEST_MAX = 12
export const UNIT_TEST_XP = 30

export interface UnitTestRecord {
  best: number
  passed: boolean
}

export const unitTestKey = (unitId: string) => `unittest.${unitId}`

export function unitTestItems(unitId: string, seed?: number): Exercise[] {
  const unit = UNITS.find((u) => u.id === unitId)
  if (!unit) return []
  return shuffle(unit.lessonIds.flatMap((id) => getLesson(id)?.quiz ?? []), seed).slice(0, UNIT_TEST_MAX)
}

/** Saves the best score; XP the first time the test is passed. Returns whether this run passed for the first time. */
export async function saveUnitTest(unitId: string, score: number) {
  const key = unitTestKey(unitId)
  const prev = (await db.kv.get(key))?.value as UnitTestRecord | undefined
  const passed = score >= UNIT_TEST_PASS
  await db.kv.put({ key, value: { best: Math.max(prev?.best ?? 0, score), passed: passed || !!prev?.passed } satisfies UnitTestRecord })
  const firstPass = passed && !prev?.passed
  if (firstPass) await addXp(UNIT_TEST_XP)
  return firstPass
}
