import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ShieldCheck } from '@phosphor-icons/react'
import { Card, Notice, PageTitle } from '../components/ui'
import { ExerciseRunner, ResultsSummary, type RunnerResult } from '../components/ExerciseRunner'
import { recordAttempt } from '../lib/repo'
import { celebrate, sfx } from '../lib/fx'
import { useStudyTimer } from '../hooks/hooks'
import { UNITS, getLesson } from '../content'
import { saveUnitTest, unitTestItems, UNIT_TEST_PASS, UNIT_TEST_XP } from '../lib/unitTest'

export default function UnitTest() {
  useStudyTimer()
  const { unitId } = useParams()
  const unit = UNITS.find((u) => u.id === unitId)
  const [run, setRun] = useState(0)
  const [started, setStarted] = useState(false)
  const [res, setRes] = useState<{ rs: RunnerResult[]; score: number; firstPass: boolean } | null>(null)
  const [items, setItems] = useState(() => (unit ? unitTestItems(unit.id) : []))
  if (!unit || !items.length) return <Notice tone="error">Unit test not found.</Notice>
  // Each question counts for the skill of the lesson it comes from.
  const skillOf = new Map(unit.lessonIds.flatMap((id) => { const l = getLesson(id)!; return l.quiz.map((q) => [q.id, l.skill] as const) }))

  const finish = async (rs: RunnerResult[]) => {
    const score = Math.round((rs.filter((r) => r.correct).length / rs.length) * 100)
    const firstPass = await saveUnitTest(unit.id, score)
    if (score >= UNIT_TEST_PASS) celebrate()
    else sfx.complete()
    setRes({ rs, score, firstPass })
  }

  return (
    <div className="space-y-4">
      <PageTitle back={`/learn?level=${unit.level}`} title={`Unit ${unit.order} test`} subtitle={unit.title} />
      {!started && !res && (
        <Card className="py-8 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300" aria-hidden><ShieldCheck size={44} /></span>
          <p className="mt-4 text-lg font-bold">{items.length} questions · pass at {UNIT_TEST_PASS} %</p>
          <p className="mt-1 text-sm text-ink-500">No corrections until the end. +{UNIT_TEST_XP} XP the first time you pass.</p>
          <button className="btn-cta mt-6 w-full py-3.5 text-base" onClick={() => setStarted(true)} autoFocus>Start the test</button>
        </Card>
      )}
      {started && !res && (
        <Card>
          <ExerciseRunner key={run} items={items.map((item) => ({ item }))} feedback="deferred"
            onAnswer={(r) => recordAttempt({ skill: skillOf.get(r.item.id) ?? 'grammar', level: unit.level, source: 'quiz', refId: `unittest-${unit.id}`, itemId: r.item.id, correct: r.correct }).then(() => undefined)}
            onFinish={(rs) => void finish(rs)} />
        </Card>
      )}
      {res && (
        <>
          <Notice tone={res.score >= UNIT_TEST_PASS ? 'ok' : 'warn'}>
            {res.score >= UNIT_TEST_PASS ? `Unit passed!${res.firstPass ? ` +${UNIT_TEST_XP} XP` : ''}` : `Not yet: ${UNIT_TEST_PASS} % needed. Review the lessons and try again.`}
          </Notice>
          <Card>
            <ResultsSummary results={res.rs} onRetry={() => { setItems(unitTestItems(unit.id)); setRun((r) => r + 1); setRes(null); setStarted(true) }}>
              <Link to={`/learn?level=${unit.level}`} className="btn-primary">Back to the path</Link>
            </ResultsSummary>
          </Card>
        </>
      )}
    </div>
  )
}
