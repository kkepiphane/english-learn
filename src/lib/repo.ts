import { db, uuid, today, type Attempt, type Assessment, type Profile, type Card } from '../db/db'
import type { Level, Skill } from '../content/types'
import { newCard, review, type Grade } from './srs'
import { XP } from './stats'

export async function getProfile() {
  return db.profile.get('me')
}

export async function saveProfile(patch: Partial<Profile>) {
  const now = Date.now()
  const cur = await db.profile.get('me')
  const next: Profile = {
    id: 'me',
    name: '',
    nativeLanguage: 'fr',
    goalLevel: 'B2',
    exam: 'none',
    dailyGoalMin: 20,
    currentLevel: null,
    skillLevels: {},
    theme: 'system',
    uiFrench: true,
    createdAt: now,
    ...cur,
    ...patch,
    updatedAt: now,
  }
  await db.profile.put(next)
  return next
}

export async function addXp(xp: number) {
  const day = today()
  await db.transaction('rw', db.sessions, async () => {
    const s = (await db.sessions.get(day)) ?? { day, seconds: 0, xp: 0 }
    s.xp += xp
    await db.sessions.put(s)
  })
}

/** Called every 15 s by the activity tracker while a learning screen is visible. */
export async function addStudyTime(seconds: number) {
  const day = today()
  let s = (await db.sessions.get(day)) ?? { day, seconds: 0, xp: 0 }
  s = { ...s, seconds: s.seconds + seconds }
  await db.sessions.put(s)
}

export async function recordAttempt(a: Omit<Attempt, 'uuid' | 'at'>) {
  const full: Attempt = { ...a, uuid: uuid(), at: Date.now() }
  await db.attempts.add(full)
  if (a.correct) await addXp(XP.correct)
  return full
}

export async function saveAssessment(a: Omit<Assessment, 'uuid' | 'at'>) {
  const full: Assessment = { ...a, uuid: uuid(), at: Date.now() }
  await db.assessments.add(full)
  return full
}

export async function completeLesson(lessonId: string, score: number) {
  const cur = await db.lessonProgress.get(lessonId)
  const firstPass = !cur || cur.status !== 'completed'
  const next = {
    lessonId,
    status: 'completed' as const,
    bestScore: Math.max(cur?.bestScore ?? 0, score),
    attempts: (cur?.attempts ?? 0) + 1,
    updatedAt: Date.now(),
  }
  await db.lessonProgress.put(next)
  if (firstPass) {
    await addXp(XP.lessonDone)
    // The lesson will come back for short reviews after 1 week, 2 weeks and 1 month.
    await db.kv.put({ key: `review.${lessonId}`, value: { base: Date.now(), stage: 0 } })
  }
  return { firstPass }
}

export async function startLesson(lessonId: string) {
  const cur = await db.lessonProgress.get(lessonId)
  if (!cur) await db.lessonProgress.put({ lessonId, status: 'started', bestScore: 0, attempts: 0, updatedAt: Date.now() })
}

export async function addCards(items: { id: string; front: string; back: string; ipa?: string; example?: string; source: string }[]) {
  const existing = new Set((await db.cards.bulkGet(items.map((i) => i.id))).filter(Boolean).map((c) => c!.id))
  const fresh = items.filter((i) => !existing.has(i.id)).map((i) => newCard(i))
  if (fresh.length) {
    await db.cards.bulkAdd(fresh)
  }
  return fresh.length
}

export async function gradeCard(card: Card, grade: Grade) {
  const next = review(card, grade)
  await db.cards.put(next)
  await addXp(XP.cardReview)
  // A flashcard review is also evidence for the vocabulary skill.
  await recordAttempt({ skill: 'vocabulary', level: (card.source.match(/^(A2|B1|B2|C1)/)?.[1] as Level) ?? 'A2', source: 'flashcard', refId: card.id, itemId: card.id, correct: grade >= 2 })
  return next
}

export async function applyPlacement(overall: Level | 'pre-A2', perSkill: Partial<Record<Skill, { level: Level | 'pre-A2' }>>) {
  const skillLevels = Object.fromEntries(Object.entries(perSkill).map(([k, v]) => [k, v!.level]))
  await saveProfile({ currentLevel: overall, skillLevels })
  await db.kv.put({ key: 'placement.done', value: Date.now() })
}

/** Opens the weekly chest once per week, when every weekly challenge is done. Returns false if already opened. */
export async function claimChest(week: string, xp: number) {
  const key = `chest.${week}`
  return db.transaction('rw', db.kv, db.sessions, async () => {
    if (await db.kv.get(key)) return false
    await db.kv.put({ key, value: Date.now() })
    await addXp(xp)
    return true
  })
}

export const bitesKey = (lessonId: string) => `lesson.bites.${lessonId}`

/** Records that a bite of a lesson is finished. XP only the first time each bite is reached. */
export async function completeBite(lessonId: string, bitesDone: number) {
  const key = bitesKey(lessonId)
  return db.transaction('rw', db.kv, db.sessions, async () => {
    const prev = ((await db.kv.get(key))?.value as number | undefined) ?? 0
    if (bitesDone <= prev) return false
    await db.kv.put({ key, value: bitesDone })
    await addXp(XP.biteDone)
    return true
  })
}
