import type { Attempt, Card, LessonProgress, Profile, StudySession, WritingSubmission } from '../db/db'
import { today } from '../db/db'
import { lessonsFor, availableLevels } from '../content'
import type { Lesson, Level, Skill } from '../content/types'
import { CORE_SKILLS, CROSS_SKILLS } from '../content/types'
import { skillMastery, type SkillMastery } from './mastery'
import { startingLevel } from './scoring'

/** Placement answers include deliberately too-hard items: they don't count toward day-to-day mastery. */
export const masteryAttempts = (a: Attempt[]) => a.filter((x) => x.source !== 'placement')

/** The level the learner is currently working on (one above the demonstrated level). */
export function learningLevel(p: Profile | null | undefined): Level {
  const lvl = p?.currentLevel ? startingLevel(p.currentLevel) : 'A2'
  const avail = availableLevels()
  return avail.includes(lvl) ? lvl : avail[avail.length - 1]
}

export function allMastery(attempts: Attempt[]): SkillMastery[] {
  const a = masteryAttempts(attempts)
  return [...CORE_SKILLS, ...CROSS_SKILLS].map((s) => skillMastery(s, a))
}

export function nextLesson(level: Level, progress: LessonProgress[]): Lesson | undefined {
  const done = new Set(progress.filter((p) => p.status === 'completed').map((p) => p.lessonId))
  return lessonsFor(level).find((l) => !done.has(l.id))
}

export interface Challenge {
  id: string
  label: string
  done: number
  target: number
}

export function dailyChallenges(sessions: StudySession[], attempts: Attempt[], cards: Card[], goalMin: number, now = new Date()): Challenge[] {
  const day = today(now)
  const s = sessions.find((x) => x.day === day)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const todays = attempts.filter((a) => a.at >= start.getTime())
  const reviewedToday = cards.filter((c) => c.updatedAt >= start.getTime() && c.reps + c.lapses > 0).length
  const due = cards.filter((c) => c.due <= now.getTime()).length
  return [
    { id: 'time', label: `Study ${goalMin} minutes`, done: Math.round((s?.seconds ?? 0) / 60), target: goalMin },
    { id: 'correct', label: 'Get 15 correct answers', done: todays.filter((a) => a.correct).length, target: 15 },
    // With no due cards the review challenge can't be done: ask to save new words instead.
    reviewedToday + due > 0
      ? { id: 'cards', label: 'Review your due flashcards', done: reviewedToday, target: reviewedToday + due }
      : { id: 'cards', label: 'Save 5 new words to your flashcards', done: cards.filter((c) => c.reps + c.lapses === 0 && c.updatedAt >= start.getTime()).length, target: 5 },
  ]
}

/** Monday of the week containing `now`, as YYYY-MM-DD (weekly challenges and the chest reset every Monday). */
export function weekStart(now = new Date()): string {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return today(d)
}

export function weeklyChallenges(sessions: StudySession[], writings: WritingSubmission[], attempts: Attempt[], now = new Date()): Challenge[] {
  const from = weekStart(now)
  const activeDays = sessions.filter((s) => s.day >= from && s.seconds >= 60).length
  const since = new Date(from + 'T00:00:00').getTime()
  return [
    { id: 'days', label: 'Study on 5 different days', done: activeDays, target: 5 },
    { id: 'writing', label: 'Submit 1 writing task', done: writings.filter((w) => w.at >= since).length, target: 1 },
    { id: 'listening', label: 'Answer 10 listening questions', done: attempts.filter((a) => a.at >= since && a.skill === 'listening').length, target: 10 },
  ]
}

export function weakestSkills(m: SkillMastery[], n = 3): SkillMastery[] {
  // Speaking/pronunciation are Phase 2: only rank skills that have evidence or exercises available.
  const rankable: Skill[] = ['grammar', 'vocabulary', 'reading', 'listening', 'writing']
  return m
    .filter((x) => rankable.includes(x.skill))
    .sort((a, b) => (a.status === 'not-started' ? 50 : a.score) - (b.status === 'not-started' ? 50 : b.score))
    .slice(0, n)
}

/** Kind, non-guilt coaching message. */
export function coachMessage(streak: number, minutesToday: number, goal: number, lastActiveDay?: string): string {
  if (minutesToday >= goal) return 'Daily goal reached. Great work — anything more today is a bonus.'
  if (streak === 0 && lastActiveDay) return 'Welcome back! A short 10-minute session is a perfect restart. No pressure.'
  if (minutesToday > 0) return `${goal - minutesToday} more minutes to reach today's goal. You're on your way.`
  if (streak >= 3) return `${streak} days in a row! Keep it light today: one lesson or your flashcards is enough.`
  return 'Start small: one lesson today makes a real difference over a month.'
}
