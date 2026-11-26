import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Exercise } from '../content/types'
import { correctAnswerText, isCorrect, shuffle, type Answer } from '../lib/exercise'
import { speak, stop, ttsAvailable } from '../lib/tts'
import { Bar, CountUp, Stars } from './ui'
import { CheckCircle, Fire, Play, XCircle } from '@phosphor-icons/react'
import { sfx } from '../lib/fx'
import { addXp } from '../lib/repo'
import { stars } from '../lib/rewards'

const PRAISE = ['Nice one.', 'Well done.', 'Spot on.', 'Great.', 'Exactly.', 'Brilliant.']
const COMBO_STEPS = [3, 5, 10, 15, 20]
export const COMBO_XP = 10

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
  bare = false,
}: {
  items: RunnerItem[]
  onAnswer?: (r: RunnerResult) => void | Promise<void>
  onFinish: (results: RunnerResult[]) => void
  /** 'deferred' = test mode: no correction until the end (placement, checkpoint). */
  feedback?: 'immediate' | 'deferred'
  title?: string
  /** Single-question card inside a lesson deck: no progress row (the deck shows its own). */
  bare?: boolean
}) {
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState<Answer>(null)
  const [checked, setChecked] = useState(false)
  const [results, setResults] = useState<RunnerResult[]>([])
  const [combo, setCombo] = useState(0)
  const [comboHit, setComboHit] = useState(false)
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
    // Immediate mode only: sounds and combos would give away answers in a test.
    const c = correct ? combo + 1 : 0
    const hit = COMBO_STEPS.includes(c)
    setCombo(c)
    setComboHit(hit)
    if (hit) {
      sfx.combo()
      void addXp(COMBO_XP)
    } else if (correct) sfx.correct()
    else sfx.wrong()
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
      {!bare && <div className="flex items-center gap-3">
        <Bar value={((i + (checked ? 1 : 0)) / items.length) * 100} className="h-3" color="bg-emerald-500" label="Exercise progress" />
        {combo >= 2 && feedback === 'immediate' && <span key={combo} className="chip animate-pop bg-flame-100 font-bold text-flame-700 dark:bg-flame-900/40 dark:text-flame-200" aria-label={`${combo} correct in a row`}><Fire weight="fill" aria-hidden /> {combo}</span>}
        <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-400">{i + 1}/{items.length}</span>
      </div>}
      {title && <p className="label">{title}</p>}
      {cur.listen && <ListenBox text={cur.listen} key={cur.item.id} />}
      <ItemView key={cur.item.id} ex={cur.item} answer={answer} setAnswer={setAnswer} disabled={checked} onEnter={() => (checked ? advance() : void submit())} />

      {checked && (
        <div role="status" className={clsx('animate-rise rounded-2xl border-2 p-4 text-sm', ok ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/30' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/30')}>
          <p className={clsx('font-display text-lg font-extrabold', ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
            {ok ? <><CheckCircle weight="fill" className="mr-1 inline align-[-3px]" aria-hidden />Correct! <span className="font-sans text-sm font-semibold">{PRAISE[i % PRAISE.length]}</span></> : <><XCircle weight="fill" className="mr-1 inline align-[-3px]" aria-hidden />Not quite. Answer: {correctAnswerText(cur.item)}</>}
          </p>
          {comboHit && <p className="mt-1 animate-pop font-bold text-flame-600 dark:text-flame-300"><Fire weight="fill" className="inline align-[-2px]" aria-hidden /> {combo} in a row! +{COMBO_XP} XP</p>}
          <p className="mt-1 text-ink-700 dark:text-ink-200">{cur.item.explanation}</p>
        </div>
      )}

      <div className="flex justify-end">
        {!checked ? (
          <button className="btn-primary min-w-32 py-3" onClick={() => void submit()} disabled={answer === null || answer === ''}>
            {feedback === 'deferred' ? (i + 1 === items.length ? 'Finish' : 'Next') : 'Check'}
          </button>
        ) : (
          <button className={clsx('btn-primary min-w-32 py-3', checked && !ok && 'bg-rose-500 shadow-[0_3px_0_0_theme(colors.rose.700)] hover:bg-rose-400')} onClick={() => advance()} autoFocus>
            {bare ? 'Continue' : i + 1 === items.length ? 'See results' : 'Continue'}
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
        <Play weight="fill" aria-hidden /> {plays === 0 ? 'Play audio' : plays === 1 ? 'Play again (last time)' : 'No more replays'}
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
                className={clsx('rounded-2xl border-2 border-b-4 px-4 py-3 text-left text-[15px] font-semibold transition active:translate-y-[2px] active:border-b-2', {
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
export function ResultsSummary({ results, onRetry, xp, children }: { results: RunnerResult[]; onRetry?: () => void; xp?: number; children?: React.ReactNode }) {
  const good = results.filter((r) => r.correct).length
  const pct = results.length ? Math.round((good / results.length) * 100) : 0
  const wrong = results.filter((r) => !r.correct)
  const mood = pct >= 90 ? { icon: '🏆', text: 'Outstanding!' } : pct >= 70 ? { icon: '🎉', text: 'Great job!' } : pct >= 40 ? { icon: '💪', text: 'Good effort — keep going!' } : { icon: '🌱', text: 'Every mistake is a lesson.' }
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="animate-pop text-6xl" aria-hidden>{mood.icon}</p>
        <p className="mt-2 font-display text-2xl font-extrabold">{mood.text}</p>
        <Stars n={stars(pct)} className="mt-1 text-3xl" />
        <div className="mt-3 flex justify-center gap-3">
          <div className="rounded-2xl border-2 border-emerald-200 px-4 py-2 dark:border-emerald-900"><p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Score</p><p className="font-display text-2xl font-extrabold"><CountUp to={pct} />%</p></div>
          {xp !== undefined && <div className="rounded-2xl border-2 border-flame-200 px-4 py-2 dark:border-flame-900"><p className="text-[11px] font-bold uppercase tracking-wider text-flame-600">XP earned</p><p className="font-display text-2xl font-extrabold">+<CountUp to={xp} /></p></div>}
        </div>
        <p className="mt-2 text-sm text-ink-500">{good} / {results.length} correct</p>
      </div>
      {wrong.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">Review your mistakes</h3>
          <ul className="space-y-2">
            {wrong.map((r) => (
              <li key={r.item.id} className="rounded-2xl border border-ink-100 p-3 text-sm dark:border-ink-800">
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
