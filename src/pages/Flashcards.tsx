import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Card as CardT } from '../db/db'
import { Card, PageTitle, SpeakButton, Empty } from '../components/ui'
import { addCards, gradeCard } from '../lib/repo'
import { LESSONS } from '../content'
import { useStudyTimer } from '../hooks/hooks'
import type { Grade } from '../lib/srs'

const DAY = 86_400_000
const fmt = (ms: number) => (ms < 3_600_000 ? `${Math.max(1, Math.round(ms / 60_000))} min` : ms < DAY ? `${Math.round(ms / 3_600_000)} h` : `${Math.round(ms / DAY)} d`)

export default function Flashcards() {
  useStudyTimer()
  const cards = useLiveQuery(() => db.cards.toArray(), [], [] as CardT[])
  const [flipped, setFlipped] = useState(false)
  const [reversed, setReversed] = useState(false)
  const [session, setSession] = useState(0)
  const now = Date.now()
  const due = cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due)
  const cur = due[0]

  const grade = async (g: Grade) => {
    if (!cur) return
    await gradeCard(cur, g)
    setFlipped(false)
    setSession(session + 1)
  }
  const importAllLessonVocab = async () => {
    await addCards(LESSONS.flatMap((l) => l.vocab.map((v) => ({ id: `${l.level}:${v.id}`, front: v.word, back: `${v.definition} — ${v.fr}`, ipa: v.ipa, example: v.example, source: `${l.level}:${l.id}` }))))
  }
  const preview = (g: Grade) => {
    if (!cur) return ''
    if (g === 0) return '10 min'
    const reps = cur.reps + 1
    const iv = reps === 1 ? (g === 3 ? 3 : 1) : reps === 2 ? (g === 1 ? 3 : 6) : Math.round(cur.interval * (g === 1 ? 1.2 : g === 3 ? cur.ease * 1.3 : cur.ease))
    return fmt(iv * DAY)
  }

  const learned = cards.filter((c) => c.interval >= 21).length
  return (
    <div>
      <PageTitle back="/practice" title="Flashcards" subtitle="Spaced repetition: hard words come back sooner, known words later." />
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <Card className="p-3"><p className="text-xl font-bold">{due.length}</p><p className="text-xs text-ink-400">due now</p></Card>
        <Card className="p-3"><p className="text-xl font-bold">{cards.length}</p><p className="text-xs text-ink-400">total</p></Card>
        <Card className="p-3"><p className="text-xl font-bold">{learned}</p><p className="text-xs text-ink-400">well known (21 d+)</p></Card>
      </div>

      {cards.length === 0 && (
        <Card>
          <Empty>No cards yet. Save words from lessons and texts, or add all lesson vocabulary at once.</Empty>
          <div className="text-center"><button className="btn-primary" onClick={() => void importAllLessonVocab()}>Add all lesson vocabulary</button></div>
        </Card>
      )}

      {cur ? (
        <>
          <button type="button" onClick={() => setFlipped(!flipped)} className="card flex min-h-64 w-full flex-col items-center justify-center p-6 text-center" aria-live="polite">
            {!flipped ? (
              <>
                <p className="text-3xl font-bold">{reversed ? cur.back.split(' — ')[1] ?? cur.back : cur.front}</p>
                {!reversed && cur.ipa && <p className="mt-2 font-mono text-ink-400">{cur.ipa}</p>}
                <p className="mt-6 text-sm text-ink-400">Think of the answer, then tap to reveal</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2"><SpeakButton text={cur.front} /><p className="text-2xl font-bold">{cur.front}</p></div>
                {cur.ipa && <p className="mt-1 font-mono text-ink-400">{cur.ipa}</p>}
                <p className="mt-3 text-lg">{cur.back}</p>
                {cur.example && <p className="mt-2 italic text-ink-500">“{cur.example}”</p>}
              </>
            )}
          </button>
          {flipped ? (
            <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="How well did you know it?">
              {([['Again', 0, 'bg-rose-600'], ['Hard', 1, 'bg-amber-500'], ['Good', 2, 'bg-emerald-600'], ['Easy', 3, 'bg-brand-600']] as const).map(([l, g, c]) => (
                <button key={l} className={`btn ${c} flex-col gap-0 text-white`} onClick={() => void grade(g)}>{l}<span className="text-[11px] font-normal opacity-80">{preview(g)}</span></button>
              ))}
            </div>
          ) : (
            <button className="btn-primary mt-3 w-full" onClick={() => setFlipped(true)}>Show answer</button>
          )}
          <label className="mt-3 flex items-center justify-center gap-2 text-sm text-ink-500"><input type="checkbox" checked={reversed} onChange={(e) => setReversed(e.target.checked)} /> French → English mode</label>
        </>
      ) : cards.length > 0 && (
        <Card className="text-center">
          <p className="text-lg font-semibold">🎉 All caught up!</p>
          <p className="mt-1 text-sm text-ink-500">{session > 0 ? `${session} reviews done this session. ` : ''}Next card due in {fmt(Math.min(...cards.map((c) => c.due)) - now)}.</p>
          <Link to="/learn" className="btn-ghost mt-3">Learn new words</Link>
        </Card>
      )}
    </div>
  )
}
