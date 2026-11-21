import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { checkpointItems } from '../content'
import { ExerciseRunner, ResultsSummary, type RunnerResult } from '../components/ExerciseRunner'
import { Card, PageTitle, Bar, Notice } from '../components/ui'
import { recordAttempt, saveAssessment, saveProfile, getProfile } from '../lib/repo'
import { scoreCheckpoint, CHECKPOINT_THRESHOLD } from '../lib/scoring'
import { useStudyTimer } from '../hooks/hooks'
import { celebrate, sfx } from '../lib/fx'
import type { Level, Skill } from '../content/types'
import { LEVELS } from '../content/types'

export default function Checkpoint() {
  useStudyTimer()
  const level = useParams().level as Level
  const [started, setStarted] = useState(false)
  const [res, setRes] = useState<{ rs: RunnerResult[]; passed: boolean; perSkill: Record<string, number> } | null>(null)
  const items = useMemo(() => checkpointItems(level).map((c) => ({ item: c.item, listen: c.listen, meta: { skill: c.skill } })), [level])

  const finish = async (rs: RunnerResult[]) => {
    const sc = scoreCheckpoint(rs.map((r) => ({ level, skill: r.meta!.skill as Skill, correct: r.correct })))
    await saveAssessment({
      kind: 'checkpoint', targetLevel: level, passed: sc.passed, overall: level,
      perSkill: Object.fromEntries(Object.entries(sc.perSkill).map(([k, v]) => [k, { level, score: Math.round(v * 100) }])),
      perLevel: { [level]: Math.round(sc.overall * 100) },
    })
    if (sc.passed) {
      const p = await getProfile()
      const cur = p?.currentLevel && p.currentLevel !== 'pre-A2' ? LEVELS.indexOf(p.currentLevel) : -1
      if (LEVELS.indexOf(level) > cur) await saveProfile({ currentLevel: level })
    }
    if (sc.passed) celebrate()
    else sfx.complete()
    setRes({ rs, passed: sc.passed, perSkill: sc.perSkill })
  }

  if (!items.length) return <Notice tone="warn">No checkpoint available for {level} yet.</Notice>

  return (
    <div>
      <PageTitle back="/learn" title={`${level} checkpoint`} subtitle="Prove your level. Every skill must reach 70 %." />
      {!started && !res && (
        <Card>
          <p>{items.length} questions mixing grammar, vocabulary, reading and listening at {level} level. No correction until the end.</p>
          <p className="mt-2 text-sm text-ink-500">A strong skill cannot hide a weak one: you pass only if <b>each</b> skill reaches {CHECKPOINT_THRESHOLD * 100} %. You can retake it as often as you want.</p>
          <button className="btn-primary mt-4" onClick={() => setStarted(true)}>Start</button>
        </Card>
      )}
      {started && !res && (
        <Card>
          <ExerciseRunner items={items} feedback="deferred"
            onAnswer={(r) => recordAttempt({ skill: r.meta!.skill as Skill, level, source: 'checkpoint', refId: `checkpoint-${level}`, itemId: r.item.id, correct: r.correct }).then(() => undefined)}
            onFinish={(rs) => void finish(rs)} />
        </Card>
      )}
      {res && (
        <div className="space-y-4">
          <Notice tone={res.passed ? 'ok' : 'warn'}>
            {res.passed ? `🎉 Congratulations! You have demonstrated the ${level} level. Your profile is updated.` : `Not yet — and that's normal. Review the skills below 70 %, then try again.`}
          </Notice>
          <Card className="space-y-2">
            {Object.entries(res.perSkill).map(([s, v]) => (
              <div key={s} className="flex items-center gap-3 text-sm"><span className="w-24 capitalize">{s}</span><Bar value={v * 100} color={v >= CHECKPOINT_THRESHOLD ? 'bg-emerald-500' : 'bg-rose-400'} /><span className="w-12 text-right tabular-nums">{Math.round(v * 100)}%</span></div>
            ))}
          </Card>
          <Card><ResultsSummary results={res.rs}><Link to="/learn" className="btn-primary">Back to the path</Link></ResultsSummary></Card>
        </div>
      )}
    </div>
  )
}
