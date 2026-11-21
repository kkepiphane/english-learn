import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { saveProfile } from '../lib/repo'
import type { Level } from '../content/types'
import { restoreBackup } from '../lib/backup'

export default function Onboarding() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [goal, setGoal] = useState<Level>('B2')
  const [exam, setExam] = useState<'none' | 'ielts' | 'toefl'>('ielts')
  const [minutes, setMinutes] = useState(20)
  const [err, setErr] = useState('')

  const start = async () => {
    await saveProfile({ name: name.trim() || 'Learner', goalLevel: goal, exam, dailyGoalMin: minutes })
    nav('/placement', { replace: true })
  }
  const restore = async (f: File) => {
    try {
      await restoreBackup(JSON.parse(await f.text()), 'replace')
      nav('/', { replace: true })
    } catch (e) {
      setErr((e as Error).message)
    }
  }


  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="mb-5 h-14 w-14" />
      <h1 className="text-3xl font-bold tracking-tight">Welcome to English Path</h1>
      <p className="mt-2 text-ink-500">Your personal English tutor, from A2 to C1. Everything is stored on this device and works offline.</p>
      <p className="mt-1 text-sm italic text-ink-400">🇫🇷 Votre professeur d'anglais personnel. Vos données restent sur cet appareil.</p>

      <div className="mt-8 space-y-6">
        <label className="block">
          <span className="label">Your first name</span>
          <input className="input mt-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Epiphane" autoComplete="given-name" />
        </label>
        <div>
          <span className="label">Target level</span>
          <div className="mt-2 grid grid-cols-3 gap-2">{(['B1', 'B2', 'C1'] as Level[]).map((l) => <Choice key={l} value={l} current={goal} set={setGoal}>{l}</Choice>)}</div>
        </div>
        <div>
          <span className="label">Exam you are preparing</span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Choice value="ielts" current={exam} set={setExam}>IELTS</Choice>
            <Choice value="toefl" current={exam} set={setExam}>TOEFL</Choice>
            <Choice value="none" current={exam} set={setExam}>No exam</Choice>
          </div>
        </div>
        <div>
          <span className="label">Daily goal</span>
          <div className="mt-2 grid grid-cols-4 gap-2">{[10, 20, 30, 45].map((m) => <Choice key={m} value={m} current={minutes} set={setMinutes}>{m} min</Choice>)}</div>
          <p className="mt-2 text-xs text-ink-400">Choose something realistic. Missing a day is fine — you can catch up.</p>
        </div>
      </div>

      <button className="btn-primary mt-8 py-3 text-base" onClick={() => void start()}>Start the level test →</button>
      <p className="mt-2 text-center text-xs text-ink-400">About 12 minutes · 24 questions · grammar, vocabulary, reading, listening</p>

      <label className="mt-8 cursor-pointer text-center text-sm font-medium text-brand-600 dark:text-brand-400">
        Already used English Path? Restore a backup
        <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && void restore(e.target.files[0])} />
      </label>
      {err && <p className="mt-2 text-center text-sm text-rose-600" role="alert">{err}</p>}
    </main>
  )
}

function Choice<T extends string | number>({ value, current, set, children }: { value: T; current: T; set: (v: T) => void; children: React.ReactNode }): React.ReactElement {
  return (
    <button type="button" onClick={() => set(value)} aria-pressed={value === current}
      className={clsx('rounded-xl border-2 px-3 py-2.5 text-sm font-medium', value === current ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200' : 'border-ink-200 dark:border-ink-700')}>{children}</button>
  )
}
