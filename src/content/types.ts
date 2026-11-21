// Content model — mirrors the server-side versioned content tables.
export type Level = 'A2' | 'B1' | 'B2' | 'C1'
export const LEVELS: Level[] = ['A2', 'B1', 'B2', 'C1']

export type Skill = 'reading' | 'listening' | 'writing' | 'speaking' | 'grammar' | 'vocabulary' | 'pronunciation'
export const CORE_SKILLS: Skill[] = ['reading', 'listening', 'writing', 'speaking']
export const CROSS_SKILLS: Skill[] = ['grammar', 'vocabulary', 'pronunciation']

/** One gradable item. Every item carries its own explanation so corrections are always pedagogical. */
export type Exercise =
  | { id: string; type: 'mcq'; prompt: string; options: string[]; answer: number; explanation: string; audio?: string }
  | { id: string; type: 'gap'; prompt: string; accepted: string[]; explanation: string; hint?: string }
  | { id: string; type: 'order'; prompt: string; words: string[]; answer: string; explanation: string }
  | { id: string; type: 'truefalse'; prompt: string; answer: boolean; explanation: string }

export interface VocabItem {
  id: string
  word: string
  ipa: string
  pos: string
  definition: string
  fr: string
  example: string
  context: string
}

export interface LessonSection {
  heading: string
  en: string
  fr?: string
  examples?: string[]
  table?: string[][]
}

export interface Lesson {
  id: string
  unitId: string
  level: Level
  category: 'grammar' | 'vocabulary' | 'everyday'
  skill: Skill
  title: string
  objective: string
  minutes: number
  sections: LessonSection[]
  vocab: VocabItem[]
  practice: Exercise[]
  quiz: Exercise[]
  rememberErrors: { wrong: string; right: string; why: string }[]
  version: number
}

export interface Unit {
  id: string
  level: Level
  order: number
  title: string
  description: string
  lessonIds: string[]
}

export interface ReadingText {
  id: string
  level: Level
  topic: string
  title: string
  minutes: number
  paragraphs: string[]
  glossary: Record<string, { def: string; fr: string; ipa?: string }>
  summary: string
  questions: Exercise[]
}

export interface ListeningItem {
  id: string
  level: Level
  kind: string
  title: string
  /** Lines are spoken with on-device TTS (works offline when the OS ships voices). */
  lines: { speaker: string; text: string }[]
  questions: Exercise[]
  vocab: { word: string; def: string }[]
}

export interface WritingPrompt {
  id: string
  level: Level
  kind: 'sentences' | 'paragraph' | 'email' | 'opinion' | 'experience' | 'summary'
  title: string
  instructions: string
  minWords: number
  maxWords: number
  checklist: string[]
  usefulLanguage: string[]
  modelAnswer: string
}

export interface PlacementQuestion {
  id: string
  level: Level
  skill: Skill
  item: Exercise
  /** For listening items: text spoken by TTS before the question. */
  listen?: string
}
