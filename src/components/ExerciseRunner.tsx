import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Exercise } from '../content/types'
import { correctAnswerText, isCorrect, shuffle, type Answer } from '../lib/exercise'
import { speak, stop, ttsAvailable } from '../lib/tts'
import { Bar } from './ui'

export interface RunnerItem {
  item: Exercise
  /** Text spoken with TTS before answering (listening items). */
  listen?: string
  meta?: Record<string, string>
}

export interface RunnerResult {
  item: Exercise
  answer: Answer
  correct: boolean
  meta?: Record<string, string>
}

/**
 * Runs a list of exercises one by one: answer → check → explanation → next.
 * Every answer is reported through onAnswer (the caller records it in IndexedDB),
 * so progress is saved item by item and never lost if the app is closed.
 */
export function ExerciseRunner({
  items,
  onAnswer,
  onFinish,
  feedback = 'immediate',
  title,
}: {
  items: RunnerItem[]
  onAnswer?: (r: RunnerResult) => void | Promise<void>
  onFinish: (results: RunnerResult[]) => void
  /** 'deferred' = test mode: no correction until the end (placement, checkpoint). */
  feedback?: 'immediate' | 'deferred'
  title?: string
}) {
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState<Answer>(null)
  const [checked, setChecked] = useState(false)
  const [results, setResults] = useState<RunnerResult[]>([])
  const cur = items[i]

  useEffect(() => () => stop(), [])

  if (!cur) return null
  const ok = checked && isCorrect(cur.item, answer)

  const submit = async () => {
    if (answer === null || answer === '') return
    const correct = isCorrect(cur.item, answer)
    const r = { item: cur.item, answer, correct, meta: cur.meta }
    await onAnswer?.(r)
    const next = [...results, r]
    setResults(next)
    if (feedback === 'deferred') return advance(next)
    setChecked(true)
  }
  const advance = (res = results) => {
    stop()
    if (i + 1 >= items.length) return onFinish(res)
    setI(i + 1)
    setAnswer(null)
    setChecked(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Bar value={((i + (checked ? 1 : 0)) / items.length) * 100} label="Exercise progress" />
        <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-400">{i + 1}/{items.length}</span>
      </div>
      {title && <p className="label">{title}</p>}
      {cur.listen && <ListenBox text={cur.listen} key={cur.item.id} />}
      <ItemView key={cur.item.id} ex={cur.item} answer={answer} setAnswer={setAnswer} disabled={checked} onEnter={() => (checked ? advance() : void submit())} />

      {checked && (
        <div role="status" className={clsx('rounded-xl border p-3.5 text-sm', ok ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-900/30' : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-900/30')}>
          <p className="font-semibold">{ok ? '✓ Correct!' : `✗ Not quite. Answer: ${correctAnswerText(cur.item)}`}</p>
          <p className="mt-1 text-ink-700 dark:text-ink-200">{cur.item.explanation}</p>
        </div>
      )}

      <div className="flex justify-end">
        {!checked ? (
          <button className="btn-primary min-w-32" onClick={() => void submit()} disabled={answer === null || answer === ''}>
            {feedback === 'deferred' ? (i + 1 === items.length ? 'Finish' : 'Next') : 'Check'}
          </button>
        ) : (
          <button className="btn-primary min-w-32" onClick={() => advance()} autoFocus>
            {i + 1 === items.length ? 'See results' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  )
}

function ListenBox({ text }: { text: string }) {
  const [plays, setPlays] = useState(0)
  const [rate, setRate] = useState(1)
  if (!ttsAvailable())
    return <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">This device has no speech voice. Transcript: “{text}”</p>
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 p-3 dark:bg-brand-900/30">
      <button className="btn-primary" onClick={() => { speak(text, { rate }); setPlays(plays + 1) }} disabled={plays >= 2}>
        ▶ {plays === 0 ? 'Play audio' : plays === 1 ? 'Play again (last time)' : 'No more replays'}
      </button>
      <label className="flex items-center gap-2 text-sm">
        Speed
        <select className="input w-auto py-1" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
          <option value={0.75}>0.75×</option>
          <option value={1}>1×</option>
        </select>
      </label>
    </div>
  )
}

function ItemView({ ex, answer, setAnswer, disabled, onEnter }: { ex: Exercise; answer: Answer; setAnswer: (a: Answer) => void; disabled: boolean; onEnter: () => void }) {
  const showResult = disabled
  if (ex.type === 'mcq' || ex.type === 'truefalse') {
    const options = ex.type === 'mcq' ? ex.options : ['True', 'False']
    const value = (k: number) => (ex.type === 'mcq' ? k : k === 0)
    const correctIdx = ex.type === 'mcq' ? ex.answer : ex.answer ? 0 : 1
    return (
      <fieldset>
        <legend className="mb-3 text-lg font-semibold leading-snug">{ex.prompt}</legend>
        <div className="grid gap-2">
          {options.map((o, k) => {
            const selected = answer === value(k)
            return (
              <button key={k} type="button" disabled={disabled} onClick={() => setAnswer(value(k))} aria-pressed={selected}
                className={clsx('rounded-xl border-2 px-4 py-3 text-left text-[15px] transition', {
                  'border-brand-500 bg-brand-50 dark:bg-brand-900/30': selected && !showResult,
                  'border-ink-200 hover:border-ink-300 dark:border-ink-700': !selected && !showResult,
                  'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30': showResult && k === correctIdx,
                  'border-rose-400 bg-rose-50 dark:bg-rose-900/30': showResult && selected && k !== correctIdx,
                  'border-ink-100 opacity-60 dark:border-ink-800': showResult && !selected && k !== correctIdx,
                })}>
                <span className="mr-2 font-semibold text-ink-400">{String.fromCharCode(65 + k)}.</span>{o}
              </button>
            )
          })}
        </div>
      </fieldset>
    )
  }
  if (ex.type === 'gap')
    return (
      <div>
        <label htmlFor={`gap-${ex.id}`} className="mb-3 block text-lg font-semibold leading-snug">{ex.prompt}</label>
        <input id={`gap-${ex.id}`} className="input text-lg" autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={disabled} value={(answer as string) ?? ''}
          onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onEnter()} placeholder="Type your answer…" />
        {ex.hint && <p className="mt-2 text-sm text-ink-400">Hint: {ex.hint}</p>}
      </div>
    )
  return <OrderView ex={ex} setAnswer={setAnswer} disabled={disabled} />
}

function OrderView({ ex, setAnswer, disabled }: { ex: Extract<Exercise, { type: 'order' }>; setAnswer: (a: Answer) => void; disabled: boolean }) {
  const pool = useMemo(() => shuffle(ex.words.map((w, k) => ({ w, k }))), [ex])
  const [picked, setPicked] = useState<number[]>([])
  const update = (p: number[]) => {
    setPicked(p)
    setAnswer(p.length === ex.words.length ? p.map((k) => ex.words[k]).join(' ') : null)
  }
  return (
    <div>
      <p className="mb-3 text-lg font-semibold">{ex.prompt}</p>
      <div className="mb-3 flex min-h-14 flex-wrap gap-2 rounded-xl border-2 border-dashed border-ink-200 p-2 dark:border-ink-700" aria-label="Your sentence">
        {picked.map((k) => (
          <button key={k} disabled={disabled} className="rounded-lg bg-brand-600 px-3 py-1.5 text-white" onClick={() => update(picked.filter((x) => x !== k))}>{ex.words[k]}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {pool.filter(({ k }) => !picked.includes(k)).map(({ w, k }) => (
          <button key={k} disabled={disabled} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 dark:border-ink-700 dark:bg-ink-900" onClick={() => update([...picked, k])}>{w}</button>
        ))}
      </div>
    </div>
  )
}

/** End-of-exercise summary with the full correction of every mistake. */
export function ResultsSummary({ results, onRetry, children }: { results: RunnerResult[]; onRetry?: () => void; children?: React.ReactNode }) {
  const good = results.filter((r) => r.correct).length
  const pct = results.length ? Math.round((good / results.length) * 100) : 0
  const wrong = results.filter((r) => !r.correct)
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-5xl font-bold tabular-nums">{pct}%</p>
        <p className="mt-1 text-ink-500">{good} / {results.length} correct</p>
      </div>
      {wrong.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">Review your mistakes</h3>
          <ul className="space-y-2">
            {wrong.map((r) => (
              <li key={r.item.id} className="rounded-xl border border-ink-100 p-3 text-sm dark:border-ink-800">
                <p className="font-medium">{r.item.prompt}</p>
                <p className="mt-1"><span className="text-rose-600 line-through dark:text-rose-400">{formatAnswer(r)}</span> → <span className="font-semibold text-emerald-700 dark:text-emerald-400">{correctAnswerText(r.item)}</span></p>
                <p className="mt-1 text-ink-500 dark:text-ink-400">{r.item.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry && <button className="btn-ghost" onClick={onRetry}>Try again</button>}
        {children}
      </div>
    </div>
  )
}

const formatAnswer = (r: RunnerResult) =>
  r.item.type === 'mcq' ? r.item.options[r.answer as number] : r.item.type === 'truefalse' ? (r.answer ? 'True' : 'False') : String(r.answer)
