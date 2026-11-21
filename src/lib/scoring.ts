import type { Level, Skill } from '../content/types'
import { LEVELS } from '../content/types'

export interface ItemResult {
  level: Level
  skill: Skill
  correct: boolean
}

/** A level is "demonstrated" only if accuracy at that level is ≥ threshold AND enough evidence exists. */
export const PASS_THRESHOLD = 0.6
export const MIN_ITEMS_PER_LEVEL = 4

export interface PlacementResult {
  overall: Level | 'pre-A2'
  perLevel: Partial<Record<Level, number>>
  perSkill: Partial<Record<Skill, { level: Level | 'pre-A2'; score: number }>>
}

const accuracy = (rs: ItemResult[]) => (rs.length ? rs.filter((r) => r.correct).length / rs.length : 0)

/**
 * Cumulative rule: you are placed at level L only if you passed L and every level below it.
 * Passing B1 items while failing A2 items does NOT place you in B1 (guessing protection).
 */
export function placeLevel(results: ItemResult[], minItems = MIN_ITEMS_PER_LEVEL): Level | 'pre-A2' {
  let placed: Level | 'pre-A2' = 'pre-A2'
  for (const lvl of LEVELS) {
    const rs = results.filter((r) => r.level === lvl)
    if (rs.length < minItems || accuracy(rs) < PASS_THRESHOLD) break
    placed = lvl
  }
  return placed
}

export function scorePlacement(results: ItemResult[]): PlacementResult {
  const perLevel: PlacementResult['perLevel'] = {}
  for (const lvl of LEVELS) {
    const rs = results.filter((r) => r.level === lvl)
    if (rs.length) perLevel[lvl] = Math.round(accuracy(rs) * 100)
  }
  const perSkill: PlacementResult['perSkill'] = {}
  const skills = [...new Set(results.map((r) => r.skill))]
  for (const s of skills) {
    const rs = results.filter((r) => r.skill === s)
    // Per-skill evidence is thinner, so require fewer items per level.
    perSkill[s] = { level: placeLevel(rs, 2), score: Math.round(accuracy(rs) * 100) }
  }
  return { overall: placeLevel(results), perLevel, perSkill }
}

/** The learning path starts at A2 even for pre-A2 learners (A2 units begin with consolidation). */
export const startingLevel = (placed: Level | 'pre-A2'): Level =>
  placed === 'pre-A2' ? 'A2' : placed === 'C1' ? 'C1' : LEVELS[Math.min(LEVELS.indexOf(placed) + 1, LEVELS.length - 1)]

/** Checkpoint (level-up test): every tested skill must reach 70 % — a strong area cannot hide a weak one. */
export const CHECKPOINT_THRESHOLD = 0.7
export function scoreCheckpoint(results: ItemResult[]) {
  const skills = [...new Set(results.map((r) => r.skill))]
  const perSkill = Object.fromEntries(skills.map((s) => [s, accuracy(results.filter((r) => r.skill === s))])) as Record<Skill, number>
  const passed = skills.length > 0 && skills.every((s) => perSkill[s] >= CHECKPOINT_THRESHOLD)
  return { passed, perSkill, overall: accuracy(results) }
}
