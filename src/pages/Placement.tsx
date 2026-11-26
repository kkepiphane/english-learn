import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PLACEMENT } from '../content'
import { ExerciseRunner, type RunnerResult } from '../components/ExerciseRunner'
import { recordAttempt, saveAssessment, applyPlacement, addXp } from '../lib/repo'
import { scorePlacement, startingLevel, type PlacementResult } from '../lib/scoring'
import { XP } from '../lib/stats'
import { Card, Bar, LevelBadge } from '../components/ui'
import { useStudyTimer } from '../hooks/hooks'
import type { Level, Skill } from '../content/types'
import { LEVELS } from '../content/types'

export default function Placement() {
  useStudyTimer()
  const nav = useNavigate()
  const [started, setStarted] = useState(false)
  const [result, setResult] = useState<PlacementResult | null>(null)
  // Ordered by level so the learner warms up; items keep their level/skill tags for scoring.
  const items = useMemo(() => [...PLACEMENT].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level)).map((p) => ({ item: p.item, listen: p.listen, meta: { level: p.level, skill: p.skill } })), [])

  const finish = async (rs: RunnerResult[]) => {
    const scored = scorePlacement(rs.map((r) => ({ level: r.meta!.level as Level, skill: r.meta!.skill as Skill, correct: r.correct })))
    await saveAssessment({ kind: 'placement', overall: scored.overall, perSkill: scored.perSkill, perLevel: scored.perLevel })
    await applyPlacement(scored.overall, scored.perSkill)
    await addXp(XP.placementDone)
    setResult(scored)
  }

  if (result) {
    const next = startingLevel(result.overall)
    return (
      <main className="mx-auto max-w-lg px-5 py-10">
        <p className="label">Your result</p>
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold">Estimated level <LevelBadge level={result.overall} className="text-lg" /></h1>
        <p className="mt-2 text-ink-500">
          {result.overall === 'pre-A2'
            ? 'You are building the foundations. Start with the A1 course for solid basics.'
            : `You have shown a solid ${result.overall} level. Your path now focuses on ${next}.`}
        </p>
        <Card className="mt-6 space-y-3">
          <p className="font-semibold">By level</p>
          {(Object.entries(result.perLevel) as [Level, number][]).map(([l, s]) => (
            <div key={l} className="flex items-center gap-3 text-sm"><span className="w-8 font-semibold">{l}</span><Bar value={s} color={s >= 60 ? 'bg-emerald-500' : 'bg-rose-400'} /><span className="w-10 text-right tabular-nums">{s}%</span></div>
          ))}
          <p className="pt-2 font-semibold">By skill</p>
          {Object.entries(result.perSkill).map(([s, v]) => (
            <div key={s} className="flex items-center gap-3 text-sm"><span className="w-24 capitalize">{s}</span><Bar value={v!.score} /><span className="w-14 text-right">{v!.level}</span></div>
          ))}
        </Card>
        <p className="mt-4 text-xs text-ink-400">This is a pedagogical estimate, not an official certification. Speaking and writing are assessed later in their own modules. You move up a level only by passing a level checkpoint — never just by finishing lessons.</p>
        <button className="btn-primary mt-6 w-full py-3" onClick={() => nav('/', { replace: true })}>Go to my dashboard →</button>
      </main>
    )
  }

  if (!started)
    return (
      <main className="mx-auto max-w-lg px-5 py-10">
        <h1 className="text-3xl font-bold">Level test</h1>
        <p className="mt-3 text-ink-600 dark:text-ink-300">{items.length} questions from A2 to B2: grammar, vocabulary, reading and listening. There is no correction during the test — answer honestly, guessing gives a wrong level.</p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-500">
          <li>Listening questions use your device's voice. Turn the sound on.</li>
          <li>You can listen to each audio twice.</li>
          <li>If a question is too hard, choose your best guess and continue.</li>
        </ul>
        <p className="mt-3 text-sm italic text-ink-400">🇫🇷 Pas de correction pendant le test. Répondez honnêtement : deviner fausse le résultat.</p>
        <button className="btn-primary mt-6 w-full py-3" onClick={() => setStarted(true)}>Start</button>
        <Link to="/" className="mt-3 block text-center text-sm text-ink-400">Skip for now (your level will be unknown)</Link>
      </main>
    )

  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <ExerciseRunner items={items} feedback="deferred" title="Level test"
        onAnswer={(r) => recordAttempt({ skill: r.meta!.skill as Skill, level: r.meta!.level as Level, source: 'placement', refId: 'placement', itemId: r.item.id, correct: r.correct }).then(() => undefined)}
        onFinish={(rs) => void finish(rs)} />
    </main>
  )
}
