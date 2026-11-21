import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getLesson, lessonsFor } from '../content'
import { Card, PageTitle, SpeakButton, Fr, Notice } from '../components/ui'
import { ExerciseRunner, ResultsSummary, type RunnerResult } from '../components/ExerciseRunner'
import { addCards, completeLesson, recordAttempt, startLesson } from '../lib/repo'
import { useProfile, useStudyTimer } from '../hooks/hooks'
import type { Lesson } from '../content/types'
import { XP } from '../lib/stats'
import { celebrate, sfx } from '../lib/fx'

type Step = 'learn' | 'practice' | 'quiz' | 'done'

export default function LessonPage() {
  const { id } = useParams()
  const lesson = getLesson(id!)
  if (!lesson) return <Notice tone="error">Lesson not found.</Notice>
  return <LessonView key={lesson.id} lesson={lesson} />
}

function LessonView({ lesson }: { lesson: Lesson }) {
  useStudyTimer()
  const profile = useProfile()
  const fr = profile?.uiFrench ?? true
  const [step, setStep] = useState<Step>('learn')
  const [results, setResults] = useState<RunnerResult[]>([])
  const [added, setAdded] = useState<number | null>(null)
  const [run, setRun] = useState(0)
  const [xp, setXp] = useState(0)

  useEffect(() => void startLesson(lesson.id), [lesson.id])

  const record = (source: 'lesson' | 'quiz') => (r: RunnerResult) =>
    recordAttempt({ skill: lesson.skill, level: lesson.level, source, refId: lesson.id, itemId: r.item.id, correct: r.correct }).then(() => undefined)

  const finishQuiz = async (rs: RunnerResult[]) => {
    const score = Math.round((rs.filter((r) => r.correct).length / rs.length) * 100)
    const { firstPass } = await completeLesson(lesson.id, score)
    setXp(rs.filter((r) => r.correct).length * XP.correct + (firstPass ? XP.lessonDone : 0))
    if (score >= 70) celebrate()
    else sfx.complete()
    setResults(rs)
    setStep('done')
  }
  const saveVocab = async () => {
    const n = await addCards(lesson.vocab.map((v) => ({ id: `${lesson.level}:${v.id}`, front: v.word, back: `${v.definition} — ${v.fr}`, ipa: v.ipa, example: v.example, source: `${lesson.level}:${lesson.id}` })))
    setAdded(n)
  }
  const list = lessonsFor(lesson.level)
  const nextL = list[list.findIndex((l) => l.id === lesson.id) + 1]
  const steps: Step[] = ['learn', 'practice', 'quiz', 'done']

  return (
    <div>
      <PageTitle back="/learn" title={lesson.title} subtitle={`${lesson.level} · ${lesson.category} · ≈ ${lesson.minutes} min`} />
      <ol className="mb-5 flex gap-1.5" aria-label="Lesson steps">
        {steps.map((s, k) => <li key={s} className={`h-2 flex-1 rounded-full transition-colors ${steps.indexOf(step) >= k ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-800'}`} aria-current={s === step ? 'step' : undefined}><span className="sr-only">{s}</span></li>)}
      </ol>

      {step === 'learn' && (
        <div className="space-y-4">
          <Card className="border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-900/20">
            <p className="label">Objective</p>
            <p className="mt-1 font-medium">{lesson.objective}</p>
          </Card>
          {lesson.sections.map((s, k) => (
            <Card key={k}>
              <h2 className="text-lg font-bold">{s.heading}</h2>
              <p className="mt-2 leading-relaxed">{s.en}</p>
              {s.fr && <Fr show={fr}>{s.fr}</Fr>}
              {s.examples && (
                <ul className="mt-3 space-y-1.5">
                  {s.examples.map((e) => <li key={e} className="flex items-center gap-2"><SpeakButton text={e} /><span className="italic">{e}</span></li>)}
                </ul>
              )}
              {s.table && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead><tr>{s.table[0].map((h, i) => <th key={i} className="border-b border-ink-200 px-2 py-1.5 font-semibold dark:border-ink-700">{h}</th>)}</tr></thead>
                    <tbody>{s.table.slice(1).map((row, r) => <tr key={r}>{row.map((c, i) => <td key={i} className="border-b border-ink-100 px-2 py-1.5 dark:border-ink-800">{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
          {lesson.vocab.length > 0 && (
            <Card>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold">Vocabulary</h2>
                <button className="btn-ghost" onClick={() => void saveVocab()}>{added === null ? '+ Add to flashcards' : added ? `✓ ${added} added` : '✓ Already saved'}</button>
              </div>
              <ul className="mt-3 divide-y divide-ink-100 dark:divide-ink-800">
                {lesson.vocab.map((v) => (
                  <li key={v.id} className="py-3">
                    <div className="flex items-center gap-2"><SpeakButton text={v.word} /><span className="font-semibold">{v.word}</span><span className="font-mono text-sm text-ink-400">{v.ipa}</span><span className="text-xs text-ink-400">{v.pos}</span></div>
                    <p className="mt-1 text-sm">{v.definition} {fr && <span className="text-ink-500">— {v.fr}</span>}</p>
                    <p className="mt-0.5 text-sm italic text-ink-500">“{v.example}”</p>
                    <p className="mt-0.5 text-xs text-ink-400">Context: {v.context}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <button className="btn-primary w-full py-3" onClick={() => setStep(lesson.practice.length ? 'practice' : 'quiz')}>Practice →</button>
        </div>
      )}

      {step === 'practice' && (
        <Card>
          <p className="mb-3 text-sm text-ink-500">Guided practice — read each explanation carefully.</p>
          <ExerciseRunner items={lesson.practice.map((item) => ({ item }))} onAnswer={record('lesson')} onFinish={() => setStep('quiz')} />
        </Card>
      )}

      {step === 'quiz' && (
        <Card>
          <p className="mb-3 text-sm text-ink-500">Validation quiz — your score is saved.</p>
          <ExerciseRunner key={run} items={lesson.quiz.map((item) => ({ item }))} onAnswer={record('quiz')} onFinish={(rs) => void finishQuiz(rs)} />
        </Card>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <Card>
            <ResultsSummary results={results} xp={xp} onRetry={() => { setRun(run + 1); setStep('quiz') }}>
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
      )}
    </div>
  )
}
