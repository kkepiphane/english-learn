import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import clsx from 'clsx'
import { db } from '../db/db'
import { useProfile } from '../hooks/hooks'
import { availableLevels, getLesson, unitsFor } from '../content'
import { PageTitle, Bar, Stars } from '../components/ui'
import { learningLevel, nextLesson } from '../lib/recommend'
import { stars } from '../lib/rewards'
import { buildBites } from '../lib/lessonDeck'
import type { Lesson, Level } from '../content/types'
import { LEVELS } from '../content/types'

const CAT: Record<Lesson['category'], { label: string; icon: string }> = {
  grammar: { label: 'Grammar', icon: '✏️' },
  vocabulary: { label: 'Vocabulary', icon: '🔤' },
  everyday: { label: 'Everyday English', icon: '💬' },
}

// Literal class strings so Tailwind keeps them. One colour per unit, cycling.
const UNIT_TONES = [
  'bg-brand-600 text-white shadow-[0_4px_0_0_theme(colors.brand.800)]',
  'bg-emerald-500 text-white shadow-[0_4px_0_0_theme(colors.emerald.700)]',
  'bg-flame-500 text-white shadow-[0_4px_0_0_theme(colors.flame.700)]',
  'bg-sky-500 text-white shadow-[0_4px_0_0_theme(colors.sky.700)]',
]

// Horizontal offsets (px) that make the path wind left and right.
const WIND = [0, 44, 70, 44, 0, -44, -70, -44]

export default function Learn() {
  const profile = useProfile()
  const progress = useLiveQuery(() => db.lessonProgress.toArray(), [], [])
  const checkpoints = useLiveQuery(() => db.assessments.where('kind').equals('checkpoint').toArray(), [], [])
  const biteRows = useLiveQuery(() => db.kv.where('key').startsWith('lesson.bites.').toArray(), [], [])
  const bitesDone = new Map(biteRows.map((r) => [r.key.slice('lesson.bites.'.length), r.value as number]))
  const [level, setLevel] = useState<Level | null>(null)
  const current = level ?? learningLevel(profile)
  const map = new Map(progress.map((p) => [p.lessonId, p]))
  const units = unitsFor(current)
  const all = units.flatMap((u) => u.lessonIds)
  const doneCount = all.filter((id) => map.get(id)?.status === 'completed').length
  const passed = checkpoints.some((c) => c.targetLevel === current && c.passed)
  const nextId = nextLesson(current, progress)?.id

  return (
    <div>
      <PageTitle title="Learn" subtitle="Follow the path: lessons build skills, the trophy proves them." />
      <div className="mb-4 flex gap-1.5 rounded-2xl bg-ink-100 p-1 dark:bg-ink-900" role="tablist" aria-label="Level">
        {LEVELS.map((l) => {
          const avail = availableLevels().includes(l)
          return (
            <button key={l} role="tab" aria-selected={l === current} disabled={!avail} onClick={() => setLevel(l)}
              className={clsx('flex-1 rounded-xl py-2 text-sm font-bold transition', l === current ? 'bg-white text-brand-700 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500', !avail && 'opacity-40')}
              title={avail ? undefined : 'Coming in a later content update'}>{l}{!avail && ' 🔒'}</button>
          )
        })}
      </div>

      <div className="card mb-6 flex items-center gap-3 p-4">
        <div className="flex-1">
          <p className="font-display font-bold">{current} path</p>
          <Bar value={(doneCount / Math.max(all.length, 1)) * 100} className="mt-2" label={`${current} path progress`} />
          <p className="mt-1 text-xs text-ink-400">{doneCount}/{all.length} lessons · level goes up only when you pass the checkpoint (≥ 70 % in every skill)</p>
        </div>
      </div>

      <div className="space-y-8">
        {units.map((u, ui) => (
          <section key={u.id} aria-labelledby={u.id}>
            <div className={clsx('rounded-3xl px-5 py-4', UNIT_TONES[ui % UNIT_TONES.length])}>
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">Unit {u.order}</p>
              <h2 id={u.id} className="font-display text-xl font-extrabold leading-tight">{u.title}</h2>
              <p className="mt-0.5 text-sm opacity-90">{u.description}</p>
            </div>
            <ol className="mt-6 flex flex-col items-center gap-5">
              {u.lessonIds.map((id) => {
                const l = getLesson(id)!
                const p = map.get(id)
                const done = p?.status === 'completed'
                const isNext = id === nextId
                const x = WIND[all.indexOf(id) % WIND.length]
                return (
                  <li key={id} className="flex flex-col items-center" style={{ transform: `translateX(${x}px)` }}>
                    {isNext && <span className="mb-2 animate-bounce rounded-xl bg-brand-600 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-white">{bitesDone.get(id) ? 'Continue' : 'Start'}</span>}
                    <Link to={`/learn/lesson/${id}`} aria-label={`${l.title} — ${done ? `completed, best ${p!.bestScore}%` : isNext ? 'next lesson' : p ? 'in progress' : 'not started'}`}
                      className={clsx('flex items-center justify-center rounded-full text-2xl transition active:translate-y-[3px]', isNext ? 'h-20 w-20' : 'h-[68px] w-[68px]', {
                        'bg-emerald-500 text-white shadow-[0_5px_0_0_theme(colors.emerald.700)] active:shadow-[0_2px_0_0_theme(colors.emerald.700)]': done,
                        'animate-pulsering bg-brand-600 text-white shadow-[0_5px_0_0_theme(colors.brand.800)]': isNext && !done,
                        'bg-amber-400 text-white shadow-[0_5px_0_0_theme(colors.amber.600)]': p && !done && !isNext,
                        'bg-white shadow-[0_5px_0_0_theme(colors.ink.200)] dark:bg-ink-800 dark:shadow-[0_5px_0_0_theme(colors.ink.950)]': !p && !isNext,
                      })}>
                      <span aria-hidden>{done ? '✓' : CAT[l.category].icon}</span>
                    </Link>
                    {done ? <Stars n={stars(p!.bestScore)} className="mt-2 text-sm" /> : <BiteDots lesson={l} done={bitesDone.get(id) ?? 0} />}
                    <span className={clsx('mt-1.5 max-w-[11rem] text-center text-xs font-semibold leading-tight', isNext ? 'text-brand-700 dark:text-brand-300' : 'text-ink-500')}>{l.title}</span>
                  </li>
                )
              })}
            </ol>
          </section>
        ))}

        <div className="flex flex-col items-center pb-2">
          <Link to={`/learn/checkpoint/${current}`} aria-label={`${current} checkpoint${passed ? ' — passed' : ''}`}
            className={clsx('flex h-24 w-24 items-center justify-center rounded-3xl text-5xl transition active:translate-y-[3px]',
              passed ? 'bg-flame-400 shadow-[0_6px_0_0_theme(colors.flame.600)]' : 'bg-flame-100 shadow-[0_6px_0_0_theme(colors.flame.300)] dark:bg-flame-900/40 dark:shadow-[0_6px_0_0_theme(colors.flame.900)]')}>
            <span aria-hidden>🏆</span>
          </Link>
          <p className="mt-3 font-display font-bold">{passed ? `${current} level proven!` : `${current} checkpoint`}</p>
          <p className="text-center text-xs text-ink-400">{passed ? 'You can retake it any time.' : 'Pass it to move up a level.'}</p>
        </div>
      </div>

      <Link to="/exams" className="card mt-8 flex items-center gap-3 p-4 transition hover:border-brand-300">
        <span className="text-3xl" aria-hidden>📝</span>
        <span className="flex-1"><span className="block font-display font-bold">Exam prep</span><span className="text-sm text-ink-500">IELTS Academic and TOEFL iBT formats</span></span>
        <span className="text-ink-300" aria-hidden>›</span>
      </Link>
    </div>
  )
}

/** One dot per bite of the lesson, filled when that bite is done. */
function BiteDots({ lesson, done }: { lesson: Lesson; done: number }) {
  const total = buildBites(lesson).length
  return (
    <span className="mt-2 flex gap-1" role="img" aria-label={`${done} of ${total} bites done`}>
      {Array.from({ length: total }, (_, k) => <span key={k} className={clsx('h-1.5 w-4 rounded-full', k < done ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700')} />)}
    </span>
  )
}
