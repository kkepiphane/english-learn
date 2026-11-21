import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { READINGS, LISTENINGS, WRITING_PROMPTS } from '../content'
import { Card, PageTitle } from '../components/ui'
import { ttsAvailable } from '../lib/tts'

export default function Practice() {
  const due = useLiveQuery(() => db.cards.where('due').belowOrEqual(Date.now()).count(), [], 0)
  const total = useLiveQuery(() => db.cards.count(), [], 0)
  const doneR = useLiveQuery(async () => new Set((await db.attempts.where('source').equals('reading').toArray()).map((a) => a.refId)), [], new Set<string>())
  const doneL = useLiveQuery(async () => new Set((await db.attempts.where('source').equals('listening').toArray()).map((a) => a.refId)), [], new Set<string>())
  const doneW = useLiveQuery(async () => new Set((await db.writings.toArray()).map((w) => w.promptId)), [], new Set<string>())


  return (
    <div className="space-y-6">
      <PageTitle title="Practice" subtitle="Train each skill with real texts, audio and writing tasks — all available offline." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/practice/flashcards" className="card flex items-center gap-3 p-4 transition hover:border-brand-300">
          <span className="text-3xl" aria-hidden>🃏</span>
          <div className="flex-1"><p className="font-display font-bold">Flashcards</p><p className="text-sm text-ink-500">{total} cards · {due} due now</p></div>
          <span className="btn-primary">{due ? 'Review' : 'Open'}</span>
        </Link>
        <Link to="/speaking" className="card flex items-center gap-3 p-4 transition hover:border-brand-300">
          <span className="text-3xl" aria-hidden>🎙️</span>
          <div className="flex-1"><p className="font-display font-bold">Speaking</p><p className="text-sm text-ink-500">Topic of the day · record yourself</p></div>
          <span className="text-ink-300" aria-hidden>›</span>
        </Link>
      </div>

      <section><h2 className="mb-2 text-lg font-extrabold"><span aria-hidden>📖</span> Reading</h2>
        <div className="grid gap-2">{READINGS.map((r) => <Row key={r.id} to={`/practice/reading/${r.id}`} level={r.level} title={r.title} meta={`${r.topic} · ${r.minutes} min · tap any word for its meaning`} done={doneR.has(r.id)} />)}</div>
      </section>
      <section><h2 className="mb-2 text-lg font-extrabold"><span aria-hidden>🎧</span> Listening</h2>
        {!ttsAvailable() && <p className="mb-2 text-sm text-amber-700">Your browser has no speech voice: transcripts will be shown instead.</p>}
        <div className="grid gap-2">{LISTENINGS.map((l) => <Row key={l.id} to={`/practice/listening/${l.id}`} level={l.level} title={l.title} meta={`${l.kind} · adjustable speed`} done={doneL.has(l.id)} />)}</div>
      </section>
      <section><h2 className="mb-2 text-lg font-extrabold"><span aria-hidden>✍️</span> Writing</h2>
        <div className="grid gap-2">{WRITING_PROMPTS.map((w) => <Row key={w.id} to={`/practice/writing/${w.id}`} level={w.level} title={w.title} meta={`${w.kind} · ${w.minWords}–${w.maxWords} words`} done={doneW.has(w.id)} />)}</div>
      </section>
      <Card className="text-sm text-ink-500">More texts and audio will be added as versioned content packs. Everything already here works without Internet.</Card>
    </div>
  )
}

function Row({ to, level, title, meta, done }: { to: string; level: string; title: string; meta: string; done: boolean }): React.ReactElement {
  return (
    <Link to={to} className="card flex items-center gap-3 p-3.5 transition hover:border-brand-300">
      <span className="chip bg-brand-100 font-bold text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">{level}</span>
      <span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="block text-xs text-ink-400">{meta}</span></span>
      {done && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white" aria-label="done">✓</span>}
    </Link>
  )
}
