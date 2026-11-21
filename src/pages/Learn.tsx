import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import clsx from 'clsx'
import { db } from '../db/db'
import { useProfile } from '../hooks/hooks'
import { availableLevels, getLesson, unitsFor } from '../content'
import { Card, PageTitle, Bar } from '../components/ui'
import { learningLevel } from '../lib/recommend'
import type { Level } from '../content/types'
import { LEVELS } from '../content/types'

const CAT: Record<string, string> = { grammar: 'Grammar', vocabulary: 'Vocabulary', everyday: 'Everyday English' }

export default function Learn() {
  const profile = useProfile()
  const progress = useLiveQuery(() => db.lessonProgress.toArray(), [], [])
  const checkpoints = useLiveQuery(() => db.assessments.where('kind').equals('checkpoint').toArray(), [], [])
  const [level, setLevel] = useState<Level | null>(null)
  const current = level ?? learningLevel(profile)
  const map = new Map(progress.map((p) => [p.lessonId, p]))
  const units = unitsFor(current)
  const all = units.flatMap((u) => u.lessonIds)
  const doneCount = all.filter((id) => map.get(id)?.status === 'completed').length
  const passed = checkpoints.some((c) => c.targetLevel === current && c.passed)

  return (
    <div>
      <PageTitle title="Learn" subtitle="Structured path: units → lessons → quiz. Lessons build skills; checkpoints prove them." />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Level">
        {LEVELS.map((l) => {
          const avail = availableLevels().includes(l)
          return (
            <button key={l} role="tab" aria-selected={l === current} disabled={!avail} onClick={() => setLevel(l)}
              className={clsx('rounded-xl px-4 py-2 text-sm font-semibold', l === current ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 dark:bg-ink-900 dark:text-ink-300', !avail && 'opacity-40')}
              title={avail ? undefined : 'Coming in a later content update'}>{l}{!avail && ' 🔒'}</button>
          )
        })}
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <p className="font-semibold">{current} path</p>
            <Bar value={(doneCount / Math.max(all.length, 1)) * 100} className="mt-2" label={`${current} path progress`} />
            <p className="mt-1 text-xs text-ink-400">{doneCount}/{all.length} lessons completed</p>
          </div>
          <Link to={`/learn/checkpoint/${current}`} className={passed ? 'btn-ghost' : 'btn-primary'}>{passed ? '✓ Checkpoint passed' : `${current} checkpoint`}</Link>
        </div>
        {!passed && <p className="mt-3 text-xs text-ink-400">Your level goes up only when you pass the checkpoint (≥ 70 % in grammar, vocabulary, reading and listening). We recommend finishing the lessons first.</p>}
      </Card>

      <div className="space-y-4">
        {units.map((u) => (
          <section key={u.id} aria-labelledby={u.id}>
            <h2 id={u.id} className="mb-1 font-bold">Unit {u.order} · {u.title}</h2>
            <p className="mb-2 text-sm text-ink-500">{u.description}</p>
            <div className="grid gap-2">
              {u.lessonIds.map((id) => {
                const l = getLesson(id)!
                const p = map.get(id)
                return (
                  <Link key={id} to={`/learn/lesson/${id}`} className="card flex items-center gap-3 p-3.5 transition hover:border-brand-300">
                    <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold', p?.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : p ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')} aria-hidden>
                      {p?.status === 'completed' ? '✓' : p ? '…' : '○'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-ink-400">{CAT[l.category]} · {l.minutes} min</span>
                      <span className="block font-medium">{l.title}</span>
                    </span>
                    {p?.status === 'completed' && <span className="text-sm tabular-nums text-ink-400">{p.bestScore}%</span>}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
