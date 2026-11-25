import type { Profile, StudySession } from '../db/db'
import { today } from '../db/db'
import type { Level } from '../content/types'

/** Why the learner studies English. Shown every day on Home so the goal stays in sight. */
export type Dream = 'travel' | 'study' | 'work' | 'exam'

export interface Why {
  dreams: Dream[]
  /** Destination, school or job the learner is aiming for (free text). */
  place?: string
  /** Target month, YYYY-MM. */
  date?: string
  /** Daily reminder time, HH:MM. */
  reminder?: string
}

export const DREAMS: Record<Dream, { icon: string; label: string; verb: string; push: string }> = {
  travel: { icon: '✈️', label: 'Travel', verb: 'Travel to', push: 'Every word you learn today is a conversation you will have abroad.' },
  study: { icon: '🎓', label: 'Study abroad', verb: 'Study in', push: 'Lectures, essays, new friends: each lesson brings that campus closer.' },
  work: { icon: '💼', label: 'Work abroad', verb: 'Work in', push: 'The job you want is interviewed in English. Train for it today.' },
  exam: { icon: '📝', label: 'Pass IELTS / TOEFL', verb: 'Pass my exam for', push: 'Exams reward steady practice, not last-minute cramming.' },
}

/** Commonly used CEFR equivalences (IELTS Academic band, TOEFL iBT total). Indicative only. */
export const EXAM_RANGE: Record<Level, { ielts: string; toefl: string }> = {
  A2: { ielts: '3.0–3.5', toefl: '—' },
  B1: { ielts: '4.0–5.0', toefl: '42–71' },
  B2: { ielts: '5.5–6.5', toefl: '72–94' },
  C1: { ielts: '7.0–8.0', toefl: '95–113' },
}

export function dreamTitle(why: Why): string {
  const d = DREAMS[why.dreams[0] ?? 'travel']
  return why.place ? `${d.verb} ${why.place}` : d.label
}

/** Days from today until the end of the target month (null if no date or already past). */
export function daysLeft(date: string | undefined, now = new Date()): number | null {
  if (!date || !/^\d{4}-\d{2}$/.test(date)) return null
  const [y, m] = date.split('-').map(Number)
  const end = new Date(y, m, 0, 23, 59) // last day of that month
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const d = Math.ceil((end.getTime() - start.getTime()) / 86_400_000)
  return d >= 0 ? d : null
}

/** XP per ISO-style week (Monday start): this week so far vs the whole of last week. */
export function weekVsWeek(sessions: StudySession[], now = new Date()) {
  const monday = new Date(now)
  monday.setHours(12, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const prev = new Date(monday)
  prev.setDate(prev.getDate() - 7)
  const thisFrom = today(monday), lastFrom = today(prev)
  const sum = (from: string, to: string) => sessions.filter((s) => s.day >= from && s.day < to).reduce((a, s) => a + s.xp, 0)
  return { thisWeek: sum(thisFrom, '9999'), lastWeek: sum(lastFrom, thisFrom) }
}

/** Personal records to beat. */
export function records(sessions: StudySession[]) {
  const bestDay = sessions.reduce((a, s) => Math.max(a, s.xp), 0)
  const bestMinutes = Math.round(sessions.reduce((a, s) => Math.max(a, s.seconds), 0) / 60)
  const todayXp = sessions.find((s) => s.day === today())?.xp ?? 0
  return { bestDay, bestMinutes, todayXp }
}

const pad = (n: number) => String(n).padStart(2, '0')

const icsDate = (x: Date) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`

/** First reminder: tomorrow at `time`, lasting 15 minutes (local "floating" time). */
function firstSlot(time: string, now: Date) {
  const [h, m] = time.split(':').map(Number)
  const s = new Date(now)
  s.setDate(s.getDate() + 1)
  s.setHours(h, m, 0, 0)
  return { s, e: new Date(s.getTime() + 15 * 60_000) }
}

/** Daily repeating calendar event (iCalendar), so the phone's own calendar reminds the learner. */
export function reminderIcs(time: string, title: string, url: string, now = new Date()): string {
  const { s, e } = firstSlot(time, now)
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//English Path//Reminder//EN', 'BEGIN:VEVENT',
    `UID:english-path-daily@english-path`, `DTSTAMP:${stamp}`, `DTSTART:${icsDate(s)}`, `DTEND:${icsDate(e)}`,
    'RRULE:FREQ=DAILY', `SUMMARY:${title}`, `DESCRIPTION:Open English Path: ${url}`, `URL:${url}`,
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

/** Google Calendar "new event" link with a daily repeat (for Android phones without .ics import). */
export function reminderGoogleUrl(time: string, title: string, url: string, now = new Date()): string {
  const { s, e } = firstSlot(time, now)
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${icsDate(s)}/${icsDate(e)}`, details: `Open English Path: ${url}`, recur: 'RRULE:FREQ=DAILY' })
  return `https://calendar.google.com/calendar/render?${q}`
}

export const whyOf = (p: Profile | null | undefined): Why | undefined => (p?.why?.dreams.length ? p.why : undefined)
