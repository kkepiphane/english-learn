import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar as RBar } from 'recharts'
import clsx from 'clsx'
import { db } from '../db/db'
import { useProfile } from '../hooks/hooks'
import { Card, PageTitle, Bar, LevelBadge, Empty } from '../components/ui'
import { allMastery, masteryAttempts } from '../lib/recommend'
import { STATUS_COLOR, STATUS_LABEL } from '../lib/mastery'
import { lastNDays, successRate } from '../lib/stats'
import { LESSONS } from '../content'
import { LEVELS } from '../content/types'

export default function Progress() {
  const profile = useProfile()
  const [range, setRange] = useState<7 | 30 | 90>(30)
  const d = useLiveQuery(async () => ({
    attempts: await db.attempts.toArray(),
    sessions: await db.sessions.toArray(),
    progress: await db.lessonProgress.toArray(),
    assessments: await db.assessments.orderBy('at').reverse().toArray(),
    cards: await db.cards.toArray(),
  }))
  if (!d || !profile) return null

  const mastery = allMastery(d.attempts)
  const att = masteryAttempts(d.attempts)
  const days = lastNDays(d.sessions, range)
  const DAY = 86_400_000
  // Daily success rate over the period (only days with answers).
  const rateSeries = days.map((x) => {
    const start = new Date(x.day + 'T00:00:00').getTime()
    const rs = att.filter((a) => a.at >= start && a.at < start + DAY)
    return { label: range === 7 ? x.label : x.day.slice(5), rate: rs.length ? Math.round((rs.filter((a) => a.correct).length / rs.length) * 100) : null, minutes: x.minutes }
  })
  const totalMin = Math.round(d.sessions.reduce((a, s) => a + s.seconds, 0) / 60)
  const periodMin = days.reduce((a, s) => a + s.minutes, 0)
  const sr = successRate(att, range)
  const completed = d.progress.filter((p) => p.status === 'completed').length
  const vocabKnown = d.cards.filter((c) => c.interval >= 21).length
  const cur = profile.currentLevel
  const curIdx = cur && cur !== 'pre-A2' ? LEVELS.indexOf(cur) : -1

  return (
    <div className="space-y-4">
      <PageTitle title="Progress" subtitle="Calculated only from your real answers and study time." />

      <Card>
        <p className="label">Estimated CEFR level</p>
        <div className="mt-3 flex items-center gap-1.5" aria-label={`Current level ${cur ?? 'unknown'}, goal ${profile.goalLevel}`}>
          {LEVELS.map((l, i) => (
            <div key={l} className="flex-1 text-center">
              <div className={clsx('h-2.5 rounded-full', i <= curIdx ? 'bg-brand-600' : 'bg-ink-200 dark:bg-ink-800')} />
              <p className={clsx('mt-1 text-sm font-semibold', l === profile.goalLevel ? 'text-brand-600' : 'text-ink-500')}>{l}{l === profile.goalLevel && ' 🎯'}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-500">Demonstrated level: <LevelBadge level={cur ?? 'not tested'} />. Levels change only through the level test and checkpoints. Retake the level test every 2–3 months to measure real progress.</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Study time', `${Math.floor(totalMin / 60)} h ${totalMin % 60} min`], ['Lessons completed', `${completed}/${LESSONS.length}`], ['Words well known', `${vocabKnown}/${d.cards.length}`], [`Success (${range} d)`, sr.total ? `${sr.rate}%` : '—']].map(([k, v]) => (
          <Card key={k} className="p-3"><p className="text-xs text-ink-400">{k}</p><p className="mt-1 text-xl font-bold tabular-nums">{v}</p></Card>
        ))}
      </div>

      <Card>
        <p className="label mb-3">Skills</p>
        <div className="space-y-2.5">
          {mastery.map((m) => (
            <div key={m.skill} className="flex items-center gap-3 text-sm">
              <span className="w-28 capitalize">{m.skill}</span>
              <Bar value={m.score} label={`${m.skill} ${m.score}%`} />
              <span className="w-10 text-right tabular-nums text-ink-400">{m.evidence ? `${m.score}%` : ''}</span>
              <span className={clsx('chip w-24 justify-center', STATUS_COLOR[m.status])}>{STATUS_LABEL[m.status]}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-400">Recency-weighted accuracy over your last 40 answers per skill. “Acquired” needs ≥ 80 % on at least 8 answers; acquired skills untouched for 14 days move to “To review”.</p>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="label">Evolution</p>
          <div className="flex gap-1" role="group" aria-label="Period">{([7, 30, 90] as const).map((r) => <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={clsx('rounded-lg px-2.5 py-1 text-sm', range === r ? 'bg-ink-800 text-white dark:bg-ink-200 dark:text-ink-900' : 'bg-ink-100 dark:bg-ink-800')}>{r} d</button>)}</div>
        </div>
        <p className="mb-1 text-sm text-ink-500">Minutes per day · {periodMin} min in total</p>
        <div className="h-36"><ResponsiveContainer><BarChart data={rateSeries}><CartesianGrid vertical={false} strokeOpacity={0.15} /><XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis width={28} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip /><RBar dataKey="minutes" fill="#1b5cf5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <p className="mb-1 mt-4 text-sm text-ink-500">Daily success rate (%)</p>
        <div className="h-36"><ResponsiveContainer><LineChart data={rateSeries}><CartesianGrid vertical={false} strokeOpacity={0.15} /><XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis width={28} domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} /><Tooltip /><Line dataKey="rate" stroke="#10b981" strokeWidth={2.5} dot={{ r: 2 }} connectNulls /></LineChart></ResponsiveContainer></div>
      </Card>

      <Card>
        <p className="label mb-2">Assessment history</p>
        {d.assessments.length === 0 ? <Empty>No test taken yet.</Empty> : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {d.assessments.map((a) => (
              <li key={a.uuid} className="flex items-center justify-between py-2.5 text-sm">
                <span>{a.kind === 'placement' ? 'Level test' : `${a.targetLevel} checkpoint`}<span className="block text-xs text-ink-400">{new Date(a.at).toLocaleDateString()}</span></span>
                {a.kind === 'placement' ? <LevelBadge level={a.overall} /> : <span className={clsx('chip', a.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>{a.passed ? 'Passed' : 'Not yet'} · {a.perLevel[a.targetLevel!]}%</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
