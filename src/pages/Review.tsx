import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowsClockwise } from '@phosphor-icons/react'
import { db } from '../db/db'
import { getLesson } from '../content'
import { Card, Notice, PageTitle } from '../components/ui'
import { ExerciseRunner, ResultsSummary, type RunnerResult } from '../components/ExerciseRunner'
import { recordAttempt } from '../lib/repo'
import { celebrate, sfx } from '../lib/fx'
import { useStudyTimer } from '../hooks/hooks'
import { completeReview, reviewItems, reviewKey, REVIEW_LABELS, REVIEW_XP, type ReviewState } from '../lib/review'

/** Short spaced review of a lesson learned 1 week, 2 weeks or 1 month ago. */
export default function Review() {
  useStudyTimer()
  const { lessonId } = useParams()
  const lesson = getLesson(lessonId ?? '')
  const data = useLiveQuery(async () => ({
    st: (await db.kv.get(reviewKey(lessonId ?? '')))?.value as ReviewState | undefined,
    p: await db.lessonProgress.get(lessonId ?? ''),
  }), [lessonId])
  const [items] = useState(() => (lesson ? reviewItems(lesson) : []))
  const [res, setRes] = useState<RunnerResult[] | null>(null)
  if (!lesson) return <Notice tone="error">Lesson not found.</Notice>
  if (!data) return null
  const stage = Math.min(data.st?.stage ?? 0, REVIEW_LABELS.length - 1)

  const finish = async (rs: RunnerResult[]) => {
    await completeReview(lesson.id, data.p?.updatedAt ?? Date.now())
    if (rs.filter((r) => r.correct).length / rs.length >= 0.7) celebrate()
    else sfx.complete()
    setRes(rs)
  }

  return (
    <div className="space-y-4">
      <PageTitle back="/" title={lesson.title} subtitle={REVIEW_LABELS[stage]} />
      {!res ? (
        <Card>
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300"><ArrowsClockwise size={18} aria-hidden />Remember this lesson? {items.length} quick questions.</p>
          <ExerciseRunner items={items.map((item) => ({ item }))}
            onAnswer={(r) => recordAttempt({ skill: lesson.skill, level: lesson.level, source: 'lesson', refId: `review-${lesson.id}`, itemId: r.item.id, correct: r.correct }).then(() => undefined)}
            onFinish={(rs) => void finish(rs)} />
        </Card>
      ) : (
        <Card>
          <ResultsSummary results={res} xp={REVIEW_XP}>
            <Link to="/" className="btn-primary">Done</Link>
            <Link to={`/learn/lesson/${lesson.id}`} className="btn-ghost">Redo the lesson</Link>
          </ResultsSummary>
        </Card>
      )}
    </div>
  )
}
