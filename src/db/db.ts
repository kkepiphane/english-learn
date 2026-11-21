import Dexie, { type Table } from 'dexie'
import type { Level, Skill } from '../content/types'

export interface Profile {
  id: 'me'
  name: string
  nativeLanguage: 'fr' | 'en'
  goalLevel: Level
  exam: 'none' | 'ielts' | 'toefl'
  dailyGoalMin: number
  /** Level demonstrated by placement / checkpoint tests — never by lessons completed. */
  currentLevel: Level | 'pre-A2' | null
  skillLevels: Partial<Record<Skill, Level | 'pre-A2'>>
  theme: 'light' | 'dark' | 'system'
  uiFrench: boolean
  /** Sound effects and vibrations (missing = on). */
  sound?: boolean
  createdAt: number
  updatedAt: number
}

/** Every graded answer. Append-only => conflict-free sync. */
export interface Attempt {
  uuid: string
  at: number
  skill: Skill
  level: Level
  source: 'lesson' | 'quiz' | 'reading' | 'listening' | 'writing' | 'placement' | 'checkpoint' | 'flashcard'
  refId: string
  itemId: string
  correct: boolean
}

export interface LessonProgress {
  lessonId: string
  status: 'started' | 'completed'
  bestScore: number
  attempts: number
  updatedAt: number
}

export interface Assessment {
  uuid: string
  at: number
  kind: 'placement' | 'checkpoint'
  targetLevel?: Level
  overall: Level | 'pre-A2'
  passed?: boolean
  perSkill: Partial<Record<Skill, { level: Level | 'pre-A2'; score: number }>>
  perLevel: Partial<Record<Level, number>>
}

/** SM-2 spaced repetition card. */
export interface Card {
  id: string
  front: string
  back: string
  ipa?: string
  example?: string
  source: string
  ease: number
  interval: number
  reps: number
  lapses: number
  due: number
  updatedAt: number
}

export interface StudySession {
  day: string // YYYY-MM-DD local
  seconds: number
  xp: number
}

export interface WritingSubmission {
  uuid: string
  promptId: string
  text: string
  at: number
  wordCount: number
  feedback: unknown
  feedbackSource: 'offline' | 'ai'
  aiFeedback?: unknown
}

export interface Recording {
  uuid: string
  topic: string
  at: number
  durationSec: number
  blob: Blob
  mime: string
}

export interface KV {
  key: string
  value: unknown
}

export class EnglishPathDB extends Dexie {
  profile!: Table<Profile, string>
  attempts!: Table<Attempt, string>
  lessonProgress!: Table<LessonProgress, string>
  assessments!: Table<Assessment, string>
  cards!: Table<Card, string>
  sessions!: Table<StudySession, string>
  writings!: Table<WritingSubmission, string>
  recordings!: Table<Recording, string>
  kv!: Table<KV, string>

  constructor(name = 'english-path') {
    super(name)
    this.version(1).stores({
      profile: 'id',
      attempts: 'uuid, at, skill, level, source, refId, [skill+level]',
      lessonProgress: 'lessonId, status, updatedAt',
      assessments: 'uuid, at, kind',
      cards: 'id, due, source',
      sessions: 'day',
      writings: 'uuid, promptId, at',
      recordings: 'uuid, at',
      kv: 'key',
    })
  }
}

export const db = new EnglishPathDB()

export const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

export const today = (d = new Date()) => {
  const y = d.getFullYear(), m = `${d.getMonth() + 1}`.padStart(2, '0'), dd = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${dd}`
}
