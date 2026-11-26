import type { BasicSheet, Exercise, Lesson, Level, ListeningItem, PlacementQuestion, ReadingText, Skill, Unit, WritingPrompt } from './types'
import lessonsA2 from './data/lessons-a2.json'
import lessonsB1 from './data/lessons-b1.json'
import lessonsB2 from './data/lessons-b2.json'
import basics from './data/a1-basics.json'
import units from './data/units.json'
import reading from './data/reading.json'
import listening from './data/listening.json'
import writing from './data/writing.json'
import placement from './data/placement.json'

/**
 * Pedagogical content = versioned JSON files in src/content/data.
 * They are bundled and precached by the service worker, so every lesson works offline after first load.
 * To add a level (B2, C1): add lessons-b2.json + units in units.json, then import it here.
 */
export const LESSONS = [...lessonsA2, ...lessonsB1, ...lessonsB2] as unknown as Lesson[]
/** A1 basics: short review sheets and timed sprints (not a levelled path). */
export const BASICS = basics as unknown as BasicSheet[]
export const getSheet = (id: string) => BASICS.find((b) => b.id === id)
export const UNITS = units as unknown as Unit[]
export const READINGS = reading as unknown as ReadingText[]
export const LISTENINGS = listening as unknown as ListeningItem[]
export const WRITING_PROMPTS = writing as unknown as WritingPrompt[]
export const PLACEMENT = placement as unknown as PlacementQuestion[]

const byId = new Map(LESSONS.map((l) => [l.id, l]))
export const getLesson = (id: string) => byId.get(id)
export const unitsFor = (level: Level) => UNITS.filter((u) => u.level === level).sort((a, b) => a.order - b.order)
export const lessonsFor = (level: Level) => UNITS.filter((u) => u.level === level).flatMap((u) => u.lessonIds.map((id) => byId.get(id)!))
export const availableLevels = (): Level[] => [...new Set(UNITS.map((u) => u.level))]

/**
 * Level checkpoint = the only way to move up a level. It mixes the four tested areas
 * (grammar, vocabulary, reading, listening) for the target level; every area must reach 70 %.
 */
export function checkpointItems(level: Level): { skill: Skill; item: Exercise; listen?: string }[] {
  const lessons = lessonsFor(level)
  const pick = <T,>(arr: T[], n: number) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)
  const grammar = pick(lessons.filter((l) => l.category === 'grammar').flatMap((l) => l.quiz), 6).map((item) => ({ skill: 'grammar' as Skill, item }))
  const vocab = pick(lessons.filter((l) => l.category !== 'grammar').flatMap((l) => l.quiz), 5).map((item) => ({ skill: 'vocabulary' as Skill, item }))
  const rd = pick(READINGS.filter((r) => r.level === level).flatMap((r) => r.questions), 4).map((item) => ({ skill: 'reading' as Skill, item }))
  const pl = PLACEMENT.filter((p) => p.level === level && p.skill === 'listening').map((p) => ({ skill: 'listening' as Skill, item: p.item, listen: p.listen }))
  return [...grammar, ...vocab, ...rd, ...pl]
}
