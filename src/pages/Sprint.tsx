import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowClockwise, CheckCircle, Ghost, PersonSimpleRun, Timer, XCircle } from '@phosphor-icons/react'
import type { Exercise } from '../content/types'
import { Card, CountUp, Notice } from '../components/ui'
import { correctAnswerText, isCorrect, type Answer } from '../lib/exercise'
import { addXp } from '../lib/repo'
import { celebrate, sfx } from '../lib/fx'
import { useStudyTimer } from '../hooks/hooks'
import { ghostAt, getRecord, saveRun, sprintInfo, sprintItems, type SprintRecord } from '../lib/sprint'

const XP_PER_CORRECT = 2

export default function Sprint() {
  const id = useParams().id!
  const info = sprintInfo(id)
  if (!info || !info.pool.length) return <Notice tone="error">Sprint not found.</Notice>
  return <SprintRun key={id} id={id} title={info.title} seconds={info.seconds} back={info.level} />
}

type Phase = 'ready' | 'run' | 'done'

function SprintRun({ id, title, seconds, back }: { id: string; title: string; seconds: number; back: string }) {
  useStudyTimer()
  const [phase, setPhase] = useState<Phase>('ready')
  const [ghost, setGhost] = useState<SprintRecord | undefined>()
  const [round, setRound] = useState(0)
  const [items, setItems] = useState(() => sprintItems(id))
  const [k, setK] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [times, setTimes] = useState<number[]>([])
  const [misses, setMisses] = useState<Exercise[]>([])
  const [flash, setFlash] = useState<'ok' | 'ko' | null>(null)
  const [record, setRecord] = useState(false)
  const start = useRef(0)
  const limit = seconds * 1000

  useEffect(() => void getRecord(id).then(setGhost), [id, round])

  useEffect(() => {
    if (phase !== 'run') return
    const t = setInterval(() => {
      const e = Date.now() - start.current
      setElapsed(Math.min(e, limit))
    }, 100)
    return () => clearInterval(t)
  }, [phase, limit])

  const finished = phase === 'run' && elapsed >= limit
  useEffect(() => {
    if (!finished) return
    void (async () => {
      const isRecord = await saveRun(id, times)
      if (times.length) await addXp(times.length * XP_PER_CORRECT)
      setRecord(isRecord)
      if (isRecord) celebrate()
      else sfx.complete()
      setPhase('done')
    })()
  }, [finished, id, times])

  const go = () => {
    start.current = Date.now()
    setElapsed(0)
    setTimes([])
    setMisses([])
    setK(0)
    setPhase('run')
  }
  const answer = (a: Answer) => {
    if (phase !== 'run' || flash) return
    const item = items[k % items.length]
    const ok = isCorrect(item, a)
    if (ok) {
      setTimes((t) => [...t, Date.now() - start.current])
      sfx.correct()
    } else {
      setMisses((m) => [...m, item])
      sfx.wrong()
    }
    setFlash(ok ? 'ok' : 'ko')
    setTimeout(() => {
      setFlash(null)
      setK((x) => x + 1)
    }, ok ? 220 : 650)
  }

  const score = times.length
  const ghostScore = ghostAt(ghost, elapsed)
  const lane = Math.max(ghost?.best ?? 0, score, 10) + 2

  if (phase === 'ready')
    return (
      <div className="space-y-4">
        <Back level={back} />
        <Card className="py-8 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-flame-50 text-flame-500 dark:bg-flame-900/30" aria-hidden><Timer size={44} weight="fill" /></span>
          <h1 className="mt-4 text-2xl font-extrabold">{title}</h1>
          <p className="mt-1 text-ink-500">{seconds} seconds. As many as you can.</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink-100 px-3 py-1.5 text-sm font-bold dark:bg-ink-800">
            <Ghost weight="fill" className="text-brand-500" aria-hidden />{ghost ? `Your ghost: ${ghost.best}` : 'No ghost yet: set the first record'}
          </p>
          <button className="btn-cta mt-6 w-full py-4 text-lg" onClick={go} autoFocus>Go!</button>
        </Card>
      </div>
    )

  if (phase === 'done')
    return (
      <div className="space-y-4">
        <Back level={back} />
        <Card className="py-8 text-center">
          <p className="animate-pop text-6xl" aria-hidden>{record ? '🏆' : score >= (ghost?.best ?? 0) ? '🤝' : '👻'}</p>
          <p className="mt-3 font-display text-2xl font-extrabold">{record ? 'New record!' : score === ghost?.best ? 'Tie with your ghost' : 'The ghost wins this time'}</p>
          <div className="mt-4 flex justify-center gap-3">
            <div className="rounded-2xl border-2 border-b-4 border-brand-200 px-5 py-2 dark:border-brand-800"><p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">You</p><p className="font-display text-3xl font-extrabold"><CountUp to={score} /></p></div>
            <div className="rounded-2xl border-2 border-b-4 border-ink-200 px-5 py-2 dark:border-ink-700"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Ghost</p><p className="font-display text-3xl font-extrabold">{ghost?.best ?? 0}</p></div>
          </div>
          {score > 0 && <p className="mt-2 text-sm font-semibold text-flame-600">+{score * XP_PER_CORRECT} XP</p>}
          <button className="btn-cta mt-6 w-full py-3.5 text-base" onClick={() => { setRound((r) => r + 1); setItems(sprintItems(id)); setPhase('ready') }}><ArrowClockwise weight="bold" aria-hidden /> Race again</button>
        </Card>
        {misses.length > 0 && (
          <Card>
            <p className="label mb-2">To remember</p>
            <ul className="space-y-2.5 text-sm">
              {[...new Map(misses.map((m) => [m.id, m])).values()].map((m) => (
                <li key={m.id}><p className="font-medium">{m.prompt}</p><p className="text-ink-500"><span className="font-bold text-brand-700 dark:text-brand-300">{correctAnswerText(m)}</span> · {m.explanation}</p></li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    )

  const item = items[k % items.length]
  const left = Math.ceil((limit - elapsed) / 1000)
  return (
    <div className="space-y-4">
      {/* Clock */}
      <div className="flex items-center gap-3">
        <span className={clsx('flex h-12 w-16 items-center justify-center rounded-2xl font-display text-2xl font-extrabold tabular-nums shadow-[0_4px_0_0] transition-colors', left <= 10 ? 'animate-pulse bg-flame-500 text-white shadow-flame-700' : 'bg-white text-ink-900 shadow-ink-200 dark:bg-ink-800 dark:text-white dark:shadow-ink-950')} role="timer" aria-label={`${left} seconds left`}>{left}</span>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800"><div className="h-full rounded-full bg-flame-400 transition-[width] duration-100" style={{ width: `${100 - (elapsed / limit) * 100}%` }} /></div>
      </div>
      {/* Race track: you vs your ghost */}
      <Card className="space-y-2 py-3">
        {[{ who: 'You', n: score, I: PersonSimpleRun, c: 'bg-brand-500 text-white' }, { who: 'Ghost', n: ghostScore, I: Ghost, c: 'bg-ink-300 text-white dark:bg-ink-600' }].map(({ who, n, I, c }) => (
          <div key={who} className="flex items-center gap-2">
            <span className="w-12 text-xs font-bold text-ink-500">{who}</span>
            <div className="relative h-8 flex-1 rounded-full bg-ink-100 dark:bg-ink-800">
              <span className={clsx('absolute top-0 flex h-8 w-8 items-center justify-center rounded-full transition-[left] duration-300', c)} style={{ left: `calc(${(n / lane) * 100}% - ${(n / lane) * 2}rem)` }} aria-hidden><I size={18} weight="fill" /></span>
            </div>
            <span className="w-6 text-right font-display font-extrabold tabular-nums">{n}</span>
          </div>
        ))}
      </Card>
      {/* Question */}
      <Card key={k} className={clsx('animate-rise transition-colors', flash === 'ok' && 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30', flash === 'ko' && 'border-rose-400 bg-rose-50 dark:bg-rose-900/30')}>
        <p className="mb-4 text-xl font-bold leading-snug">{item.prompt}</p>
        {flash === 'ko' && <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-rose-700 dark:text-rose-300"><XCircle weight="fill" aria-hidden />{correctAnswerText(item)}</p>}
        {flash === 'ok' && <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle weight="fill" aria-hidden />Correct</p>}
        <SprintAnswer item={item} onAnswer={answer} disabled={!!flash} />
      </Card>
    </div>
  )
}

function SprintAnswer({ item, onAnswer, disabled }: { item: Exercise; onAnswer: (a: Answer) => void; disabled: boolean }) {
  const [text, setText] = useState('')
  const opt = 'rounded-2xl border-2 border-b-4 border-ink-200 bg-white px-4 py-3.5 text-left text-[16px] font-semibold transition active:translate-y-[2px] active:border-b-2 dark:border-ink-700 dark:bg-ink-900'
  if (item.type === 'mcq')
    return <div className="grid grid-cols-2 gap-2.5">{item.options.map((o, i) => <button key={i} className={opt} disabled={disabled} onClick={() => onAnswer(i)}>{o}</button>)}</div>
  if (item.type === 'truefalse')
    return <div className="grid grid-cols-2 gap-2.5">{['True', 'False'].map((o, i) => <button key={o} className={clsx(opt, 'text-center')} disabled={disabled} onClick={() => onAnswer(i === 0)}>{o}</button>)}</div>
  if (item.type === 'gap')
    return (
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onAnswer(text) }}>
        <input className="input text-lg" autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} aria-label="Your answer" />
        <button className="btn-primary px-5" disabled={disabled || !text.trim()}>OK</button>
      </form>
    )
  return null
}

const Back = ({ level }: { level: string }) => <Link to={`/learn?level=${level}`} className="inline-block text-sm font-semibold text-brand-600 dark:text-brand-300">← {level}</Link>
