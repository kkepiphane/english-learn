import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useProfile } from '../hooks/hooks'
import { Card, PageTitle } from '../components/ui'
import { saveProfile } from '../lib/repo'
import { DREAMS, EXAM_RANGE, dreamTitle, reminderGoogleUrl, reminderIcs, type Dream, type Why } from '../lib/goals'
import { celebrate } from '../lib/fx'
import { Alarm as AlarmIcon, CalendarPlus, GoogleLogo, RocketLaunch } from '@phosphor-icons/react'
import { DREAM_ICON } from '../components/dreamIcons'
import type { Level } from '../content/types'
import type { Profile } from '../db/db'

export default function Goal() {
  const p = useProfile()
  if (!p) return null
  return <GoalForm key={p.id} p={p} />
}

function GoalForm({ p }: { p: Profile }) {
  const nav = useNavigate()
  const [why, setWhy] = useState<Why>(p.why ?? { dreams: [], reminder: '19:00' })
  const [goal, setGoal] = useState<Level>(p.goalLevel)
  const [exam, setExam] = useState(p.exam)
  const [err, setErr] = useState('')
  const toggle = (d: Dream) => {
    setErr('')
    setWhy((w) => ({ ...w, dreams: w.dreams.includes(d) ? w.dreams.filter((x) => x !== d) : [...w.dreams, d] }))
  }
  const save = async () => {
    if (!why.dreams.length) return setErr('Pick at least one reason.')
    await saveProfile({ why: { ...why, place: why.place?.trim() || undefined }, goalLevel: goal, exam })
    celebrate()
    nav('/')
  }
  const appUrl = location.origin + location.pathname
  const title = `🇬🇧 English time — ${dreamTitle(why.dreams.length ? why : { dreams: ['travel'] })}`
  const downloadIcs = () => {
    const blob = new Blob([reminderIcs(why.reminder ?? '19:00', title, appUrl)], { type: 'text/calendar' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'english-path-reminder.ics'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div className="space-y-4">
      <PageTitle back="/" title="My goal" subtitle="Your reason to learn, always in sight on your home screen." />

      <Card>
        <h2 className="font-display text-lg font-extrabold">Why are you learning English?</h2>
        <p className="text-sm text-ink-500">Choose one or more.</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {(Object.keys(DREAMS) as Dream[]).map((d) => {
            const on = why.dreams.includes(d)
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => toggle(d)}
                className={clsx('flex flex-col items-center gap-1.5 rounded-2xl border-2 border-b-4 px-3 py-4 text-sm font-bold transition active:translate-y-[2px] active:border-b-2', on ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100' : 'border-ink-200 dark:border-ink-700')}>
                {(() => { const I = DREAM_ICON[d]; return <I size={36} weight="fill" className={clsx('transition', on ? 'animate-pop text-brand-600 dark:text-brand-300' : 'text-ink-400')} aria-hidden /> })()}
                {DREAMS[d].label}
              </button>
            )
          })}
        </div>
        {err && <p className="mt-2 text-sm text-rose-600" role="alert">{err}</p>}
        <label className="mt-4 block"><span className="label">Where? (country, city, school, company)</span>
          <input className="input mt-1" value={why.place ?? ''} maxLength={40} placeholder="Canada" onChange={(e) => setWhy({ ...why, place: e.target.value })} /></label>
        <label className="mt-3 block"><span className="label">When? (target month)</span>
          <input type="month" className="input mt-1" value={why.date ?? ''} onChange={(e) => setWhy({ ...why, date: e.target.value || undefined })} /></label>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-extrabold">Level and exam</h2>
        <div className="mt-3 flex gap-2">
          {(['B1', 'B2', 'C1'] as Level[]).map((l) => (
            <button key={l} type="button" aria-pressed={goal === l} onClick={() => setGoal(l)} className={clsx('flex-1 rounded-2xl border-2 py-2.5 font-bold', goal === l ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100' : 'border-ink-200 dark:border-ink-700')}>{l}</button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {([['ielts', 'IELTS'], ['toefl', 'TOEFL'], ['none', 'No exam']] as const).map(([v, t]) => (
            <button key={v} type="button" aria-pressed={exam === v} onClick={() => setExam(v)} className={clsx('flex-1 rounded-2xl border-2 py-2.5 text-sm font-bold', exam === v ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100' : 'border-ink-200 dark:border-ink-700')}>{t}</button>
          ))}
        </div>
        <p className="mt-3 rounded-2xl bg-flame-50 px-3 py-2 text-sm text-flame-900 dark:bg-flame-900/30 dark:text-flame-100">
          {goal} ≈ IELTS {EXAM_RANGE[goal].ielts} · TOEFL iBT {EXAM_RANGE[goal].toefl}. Usual equivalences, given as a guide: always check the score your school, employer or visa asks for.
        </p>
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 font-display text-lg font-extrabold"><AlarmIcon size={22} weight="fill" className="text-flame-500" aria-hidden />Daily reminder</h2>
        <p className="text-sm text-ink-500">The app can't ring by itself when it's closed, so let your phone's calendar remind you every day.</p>
        <label className="mt-3 flex items-center gap-3"><span className="label">Time</span>
          <input type="time" className="input w-auto" value={why.reminder ?? '19:00'} onChange={(e) => setWhy({ ...why, reminder: e.target.value || '19:00' })} /></label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a className="btn-ghost" href={reminderGoogleUrl(why.reminder ?? '19:00', title, appUrl)} target="_blank" rel="noreferrer"><GoogleLogo size={18} weight="bold" aria-hidden /> Google Calendar (Android)</a>
          <button type="button" className="btn-ghost" onClick={downloadIcs}><CalendarPlus size={18} weight="bold" aria-hidden /> iPhone / other calendar</button>
        </div>
      </Card>

      <button className="btn-cta w-full py-3.5 text-base" onClick={() => void save()}>Save my goal <RocketLaunch weight="fill" aria-hidden /></button>
    </div>
  )
}
