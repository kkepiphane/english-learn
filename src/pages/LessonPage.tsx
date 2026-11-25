import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import clsx from 'clsx'
import { db } from '../db/db'
import { getLesson, lessonsFor } from '../content'
import { Card, SpeakButton, Fr, Notice, CountUp } from '../components/ui'
import { ExerciseRunner, ResultsSummary, type RunnerResult } from '../components/ExerciseRunner'
import { addCards, bitesKey, completeBite, completeLesson, recordAttempt, startLesson } from '../lib/repo'
import { useProfile, useStudyTimer } from '../hooks/hooks'
import type { Lesson, LessonSection, VocabItem } from '../content/types'
import { XP } from '../lib/stats'
import { buildBites, type DeckCard } from '../lib/lessonDeck'
import { celebrate, confetti, sfx } from '../lib/fx'
import { speak, ttsAvailable } from '../lib/tts'

export default function LessonPage() {
  const { id } = useParams()
  const lesson = getLesson(id!)
  const saved = useLiveQuery(async () => ((await db.kv.get(bitesKey(id!)))?.value as number | undefined) ?? 0, [id], null)
  if (!lesson) return <Notice tone="error">Lesson not found.</Notice>
  if (saved === null) return null
  return <LessonView key={lesson.id} lesson={lesson} bitesDone={saved} />
}

type Phase = { kind: 'card'; bite: number; card: number } | { kind: 'biteDone'; bite: number; xp: number; words: number } | { kind: 'done' }

function LessonView({ lesson, bitesDone }: { lesson: Lesson; bitesDone: number }) {
  useStudyTimer()
  const profile = useProfile()
  const fr = profile?.uiFrench ?? true
  const bites = useMemo(() => buildBites(lesson), [lesson])
  // Resume at the first unfinished bite; a finished lesson starts again from the beginning.
  const [phase, setPhase] = useState<Phase>({ kind: 'card', bite: bitesDone < bites.length ? bitesDone : 0, card: 0 })
  const [results, setResults] = useState<RunnerResult[]>([])
  const [xp, setXp] = useState(0)
  const [run, setRun] = useState(0)

  useEffect(() => void startLesson(lesson.id), [lesson.id])

  const list = lessonsFor(lesson.level)
  const nextL = list[list.findIndex((l) => l.id === lesson.id) + 1]
  const record = (source: 'lesson' | 'quiz') => (r: RunnerResult) =>
    recordAttempt({ skill: lesson.skill, level: lesson.level, source, refId: lesson.id, itemId: r.item.id, correct: r.correct }).then(() => undefined)

  const finishBite = async (b: number) => {
    const newly = await completeBite(lesson.id, b + 1)
    // New words go straight into spaced review: nothing to remember to click.
    const words = bites[b].cards.some((c) => c.kind === 'word')
      ? await addCards(lesson.vocab.map((v) => ({ id: `${lesson.level}:${v.id}`, front: v.word, back: `${v.definition} — ${v.fr}`, ipa: v.ipa, example: v.example, source: `${lesson.level}:${lesson.id}` })))
      : 0
    sfx.complete()
    confetti(60)
    setPhase({ kind: 'biteDone', bite: b, xp: newly ? XP.biteDone : 0, words })
  }

  const next = () => {
    if (phase.kind !== 'card') return
    const bite = bites[phase.bite]
    if (phase.card + 1 < bite.cards.length) setPhase({ ...phase, card: phase.card + 1 })
    else void finishBite(phase.bite)
  }

  const finishQuiz = async (rs: RunnerResult[]) => {
    const score = Math.round((rs.filter((r) => r.correct).length / rs.length) * 100)
    const { firstPass } = await completeLesson(lesson.id, score)
    await completeBite(lesson.id, bites.length)
    setXp(rs.filter((r) => r.correct).length * XP.correct + (firstPass ? XP.lessonDone : 0))
    if (score >= 70) celebrate()
    else sfx.complete()
    setResults(rs)
    setPhase({ kind: 'done' })
  }

  if (phase.kind === 'done')
    return (
      <div className="space-y-4">
        <Header lesson={lesson} />
        <Card>
          <ResultsSummary results={results} xp={xp} onRetry={() => { setRun(run + 1); setPhase({ kind: 'card', bite: bites.length - 1, card: 0 }) }}>
            {nextL ? <Link className="btn-primary" to={`/learn/lesson/${nextL.id}`}>Next lesson →</Link> : <Link className="btn-primary" to={`/learn/checkpoint/${lesson.level}`}>Take the {lesson.level} checkpoint</Link>}
          </ResultsSummary>
        </Card>
        {lesson.rememberErrors.length > 0 && (
          <Card>
            <h2 className="font-bold">Mistakes to remember</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {lesson.rememberErrors.map((e) => (
                <li key={e.wrong}><span className="text-rose-600 line-through dark:text-rose-400">{e.wrong}</span> → <span className="font-semibold text-emerald-700 dark:text-emerald-400">{e.right}</span><p className="text-ink-500">{e.why}</p></li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    )

  if (phase.kind === 'biteDone') {
    const nb = bites[phase.bite + 1]
    return (
      <div>
        <Header lesson={lesson} />
        <Card className="py-8 text-center">
          <p className="animate-pop text-6xl" aria-hidden>{phase.bite === 0 ? '🌟' : '🚀'}</p>
          <p className="mt-3 font-display text-2xl font-extrabold">Bite {phase.bite + 1} of {bites.length} done!</p>
          {phase.xp > 0 && <p className="mt-1 font-display text-xl font-extrabold text-flame-600">+<CountUp to={phase.xp} /> XP</p>}
          {phase.words > 0 && <p className="mt-2 text-sm text-ink-500">🃏 {phase.words} new words added to your flashcards.</p>}
          <p className="mt-3 text-sm text-ink-500">{nb ? `Next: ${nb.title} · ≈ ${nb.minutes} min. Go on now, or stop here — your place is saved.` : ''}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {nb && <button className="btn-primary py-3 text-base" onClick={() => setPhase({ kind: 'card', bite: phase.bite + 1, card: 0 })} autoFocus>Keep going →</button>}
            <Link to="/" className="btn-ghost py-3">Stop for today</Link>
          </div>
        </Card>
      </div>
    )
  }

  const bite = bites[phase.bite]
  const card = bite.cards[phase.card]
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link to="/learn" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Close the lesson (your place is saved)">✕</Link>
        <ol className="flex flex-1 gap-1" aria-label={`Card ${phase.card + 1} of ${bite.cards.length}`}>
          {bite.cards.map((_, k) => <li key={k} className={clsx('h-2.5 flex-1 rounded-full transition-colors', k < phase.card ? 'bg-emerald-500' : k === phase.card ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-800')} />)}
        </ol>
      </div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">{lesson.title} · bite {phase.bite + 1}/{bites.length} · {bite.title}</p>
      <div key={`${phase.bite}-${phase.card}-${run}`} className="animate-rise">
        <DeckCardView card={card} fr={fr} onNext={next} onAnswer={record('lesson')} onQuizAnswer={record('quiz')} onQuiz={(rs) => void finishQuiz(rs)} />
      </div>
    </div>
  )
}

const Header = ({ lesson }: { lesson: Lesson }) => (
  <div className="mb-4 flex items-center gap-3">
    <Link to="/learn" className="text-sm font-semibold text-brand-600 dark:text-brand-300">← Path</Link>
    <span className="truncate text-sm text-ink-400">{lesson.title}</span>
  </div>
)

function DeckCardView({ card, fr, onNext, onAnswer, onQuizAnswer, onQuiz }: { card: DeckCard; fr: boolean; onNext: () => void; onAnswer: (r: RunnerResult) => Promise<void>; onQuizAnswer: (r: RunnerResult) => Promise<void>; onQuiz: (rs: RunnerResult[]) => void }) {
  if (card.kind === 'hook')
    return (
      <Card>
        <p className="mb-1 font-display text-lg font-extrabold">🤔 Guess first!</p>
        <p className="mb-4 text-sm text-ink-500">You haven't seen the rule yet — trust your instinct. Getting it wrong is part of learning.</p>
        <ExerciseRunner bare items={[{ item: card.item }]} onAnswer={onAnswer} onFinish={onNext} />
      </Card>
    )
  if (card.kind === 'exercise')
    return (
      <Card>
        <p className="mb-3 font-display text-lg font-extrabold">✍️ Your turn</p>
        <ExerciseRunner bare items={[{ item: card.item }]} onAnswer={onAnswer} onFinish={onNext} />
      </Card>
    )
  if (card.kind === 'explain') return <ExplainCard s={card.section} fr={fr} onNext={onNext} />
  if (card.kind === 'word') return <WordCard v={card.vocab} fr={fr} onNext={onNext} />
  return (
    <Card>
      <p className="mb-1 font-display text-lg font-extrabold">🏁 Final quiz</p>
      <p className="mb-4 text-sm text-ink-500">{card.items.length} questions — this score is saved for the lesson.</p>
      <ExerciseRunner items={card.items.map((item) => ({ item }))} onAnswer={onQuizAnswer} onFinish={onQuiz} />
    </Card>
  )
}

function ExplainCard({ s, fr, onNext }: { s: LessonSection; fr: boolean; onNext: () => void }) {
  return (
    <div className="space-y-4">
      <Card>
        <p className="label">💡 The rule</p>
        <h2 className="mt-1 text-xl font-extrabold">{s.heading}</h2>
        <p className="mt-2 text-[17px] leading-relaxed">{s.en}</p>
        {s.fr && <Fr show={fr}>{s.fr}</Fr>}
        {s.examples && (
          <ul className="mt-4 space-y-2">
            {s.examples.map((e) => <li key={e} className="flex items-center gap-2 rounded-2xl bg-brand-50 px-3 py-2 dark:bg-brand-900/30"><SpeakButton text={e} /><span className="italic">{e}</span></li>)}
          </ul>
        )}
        {s.table && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr>{s.table[0].map((h, i) => <th key={i} className="border-b border-ink-200 px-2 py-1.5 font-semibold dark:border-ink-700">{h}</th>)}</tr></thead>
              <tbody>{s.table.slice(1).map((row, r) => <tr key={r}>{row.map((c, i) => <td key={i} className="border-b border-ink-100 px-2 py-1.5 dark:border-ink-800">{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </Card>
      <button className="btn-primary w-full py-3.5 text-base" onClick={onNext} autoFocus>Got it →</button>
    </div>
  )
}

function WordCard({ v, fr, onNext }: { v: VocabItem; fr: boolean; onNext: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setOpen(true)} disabled={open} className="card block w-full p-6 text-center">
        <p className="label">🔤 New word{open ? '' : ' · do you know it?'}</p>
        <p className="mt-3 font-display text-4xl font-extrabold">{v.word}</p>
        <p className="mt-1 font-mono text-sm text-ink-400">{v.ipa} · {v.pos}</p>
        {open ? (
          <div className="mt-4 animate-rise space-y-1.5 text-left">
            <p className="text-[17px]">{v.definition}</p>
            {fr && <p className="text-ink-500">🇫🇷 {v.fr}</p>}
            <p className="italic text-ink-600 dark:text-ink-300">“{v.example}”</p>
            <p className="text-xs text-ink-400">Context: {v.context}</p>
          </div>
        ) : <p className="mt-5 text-sm font-semibold text-brand-600 dark:text-brand-300">Think of its meaning, then tap to reveal</p>}
      </button>
      {ttsAvailable() && <button type="button" className="btn-ghost w-full py-3" onClick={() => speak(`${v.word}. ${v.example}`)}>🔊 Listen</button>}
      {open && <button className="btn-primary w-full py-3.5 text-base" onClick={onNext} autoFocus>Next →</button>}
    </div>
  )
}
