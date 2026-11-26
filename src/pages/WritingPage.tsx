import { useEffect, useState } from 'react'
import { Lightbulb } from '@phosphor-icons/react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import clsx from 'clsx'
import { WRITING_PROMPTS } from '../content'
import { db, uuid } from '../db/db'
import { Card, PageTitle, Notice, Fr } from '../components/ui'
import { analyseWriting, type WritingFeedback } from '../lib/writingCheck'
import { aiStatus, aiWritingFeedback, type AiStatus, type AiWritingFeedback } from '../lib/ai'
import { addXp, recordAttempt } from '../lib/repo'
import { XP } from '../lib/stats'
import { useOnline, useProfile, useStudyTimer } from '../hooks/hooks'
import type { WritingPrompt } from '../content/types'

export default function WritingPage() {
  const { id } = useParams()
  const w = WRITING_PROMPTS.find((x) => x.id === id)
  if (!w) return <Notice tone="error">Task not found.</Notice>
  return <Writer key={w.id} w={w} />
}

const TYPE_COLOR: Record<string, string> = {
  grammar: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  spelling: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  vocabulary: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  style: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  structure: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
}

function Writer({ w }: { w: WritingPrompt }) {
  useStudyTimer()
  const online = useOnline()
  const fr = useProfile()?.uiFrench ?? true
  const draftKey = `draft.${w.id}`
  const [text, setText] = useState('')
  const [fb, setFb] = useState<WritingFeedback | null>(null)
  const [ai, setAi] = useState<AiWritingFeedback | null>(null)
  const [aiState, setAiState] = useState<AiStatus>('not-configured')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState('')
  const [subId, setSubId] = useState<string | null>(null)
  const [showModel, setShowModel] = useState(false)
  const history = useLiveQuery(() => db.writings.where('promptId').equals(w.id).reverse().sortBy('at'), [w.id], [])

  // Autosave the draft locally so nothing is lost if the app closes.
  useEffect(() => void db.kv.get(draftKey).then((d) => d && setText(String(d.value))), [draftKey])
  useEffect(() => {
    const t = setTimeout(() => void db.kv.put({ key: draftKey, value: text }), 600)
    return () => clearTimeout(t)
  }, [text, draftKey])
  useEffect(() => void aiStatus().then(setAiState), [online])

  const words = (text.match(/[A-Za-z']+/g) ?? []).length

  const submit = async () => {
    const f = analyseWriting(text, { minWords: w.minWords, maxWords: w.maxWords, formal: w.kind === 'opinion' })
    const id = uuid()
    await db.writings.add({ uuid: id, promptId: w.id, text, at: Date.now(), wordCount: f.wordCount, feedback: f, feedbackSource: 'offline' })
    const errors = f.issues.filter((i) => i.type === 'grammar' || i.type === 'spelling').length
    // Writing evidence for mastery: one attempt per criterion ≥ 3/5.
    for (const c of f.criteria) await recordAttempt({ skill: 'writing', level: w.level, source: 'writing', refId: w.id, itemId: `${id}:${c.name}`, correct: c.score >= 3 })
    if (errors === 0 && f.wordCount >= w.minWords) await recordAttempt({ skill: 'grammar', level: w.level, source: 'writing', refId: w.id, itemId: `${id}:accuracy`, correct: true })
    await addXp(XP.writingDone)
    setFb(f)
    setAi(null)
    setSubId(id)
  }
  const askAi = async () => {
    setAiBusy(true)
    setAiErr('')
    try {
      const r = await aiWritingFeedback(text, `${w.title}. ${w.instructions}`, w.level)
      setAi(r)
      if (subId) await db.writings.update(subId, { aiFeedback: r, feedbackSource: 'ai' })
    } catch (e) {
      setAiErr((e as Error).message)
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle back="/practice" title={w.title} subtitle={`${w.level} · ${w.minWords}–${w.maxWords} words`} />
      <Card>
        <p className="font-medium">{w.instructions}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><p className="label">Checklist</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-600 dark:text-ink-300">{w.checklist.map((c) => <li key={c}>{c}</li>)}</ul></div>
          <div><p className="label">Useful language</p><ul className="mt-1 space-y-0.5 text-sm italic text-ink-600 dark:text-ink-300">{w.usefulLanguage.map((c) => <li key={c}>{c}</li>)}</ul></div>
        </div>
      </Card>

      <Card>
        <label htmlFor="writing" className="sr-only">Your text</label>
        <textarea id="writing" className="input min-h-64 leading-relaxed" value={text} onChange={(e) => { setText(e.target.value); setFb(null) }} spellCheck={false} placeholder="Write your text here… (your draft is saved automatically)" />
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className={clsx('tabular-nums', words < w.minWords ? 'text-ink-400' : words > w.maxWords ? 'text-rose-600' : 'text-emerald-600')}>{words} words</span>
          <button className="btn-primary" disabled={words < 10} onClick={() => void submit()}>Get feedback</button>
        </div>
        <p className="mt-2 text-xs text-ink-400">Browser spell-check is off on purpose: find your mistakes first, then read the correction.</p>
      </Card>

      {fb && (
        <>
          <Card>
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Offline feedback</h2><span className="chip bg-ink-100 dark:bg-ink-800">rule-based · works offline</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {fb.criteria.map((c) => <div key={c.name} className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60"><p className="text-xs text-ink-500">{c.name}</p><p className="text-xl font-bold tabular-nums">{c.score}<span className="text-sm text-ink-400">/5</span></p><p className="text-[11px] text-ink-400">{c.comment}</p></div>)}
            </div>
            <p className="mt-2 text-xs text-ink-400">Indicative scores to guide practice — not an exam band. Coherence: {fb.connectors.length} linking words ({fb.connectors.slice(0, 6).join(', ') || 'none'}). Paragraphs: {fb.paragraphCount}.</p>
            {fb.tips.length > 0 && <ul className="mt-3 space-y-1 text-sm">{fb.tips.map((t) => <li key={t} className="flex gap-2"><Lightbulb className="mt-0.5 shrink-0 text-sun-500" weight="fill" aria-hidden />{t}</li>)}</ul>}
          </Card>
          <Card>
            <h3 className="font-bold">Corrections explained ({fb.issues.length})</h3>
            {fb.issues.length === 0 ? <p className="mt-2 text-sm text-ink-500">No common error detected. The offline checker only finds frequent patterns — ask the AI for a deeper review, or compare with the model answer.</p> : (
              <ul className="mt-2 space-y-2.5">
                {fb.issues.map((i, k) => (
                  <li key={k} className="rounded-xl border border-ink-100 p-3 text-sm dark:border-ink-800">
                    <span className={clsx('chip mb-1', TYPE_COLOR[i.type])}>{i.type}</span>
                    <p><span className="text-rose-600 line-through dark:text-rose-400">{i.excerpt}</span> → <span className="font-semibold text-emerald-700 dark:text-emerald-400">{i.suggestion}</span></p>
                    <p className="mt-0.5 text-ink-600 dark:text-ink-300">{i.why}</p>
                    <Fr show={fr}>{i.whyFr}</Fr>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card><h3 className="font-bold">Your text with automatic fixes</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{fb.improved}</p></Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="font-bold">AI tutor review <span className="chip ml-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">needs Internet</span></h3>
                <p className="text-sm text-ink-500">Detailed correction, natural rephrasing and an improved version.</p></div>
              {aiState === 'ready' && <button className="btn-primary" disabled={aiBusy} onClick={() => void askAi()}>{aiBusy ? 'Analysing…' : 'Ask the AI tutor'}</button>}
            </div>
            {aiState === 'not-configured' && <Notice tone="info">AI is not configured. Add your own AI proxy in <b>Profile → AI tutor</b> (setup guide in the README). The offline feedback above stays available.</Notice>}
            {aiState === 'offline' && <Notice tone="warn">You are offline. The AI review will be available when you reconnect.</Notice>}
            {aiErr && <Notice tone="error">{aiErr}</Notice>}
            {ai && <AiView ai={ai} />}
          </Card>
        </>
      )}

      <Card>
        <button className="btn-ghost" onClick={() => setShowModel(!showModel)} aria-expanded={showModel}>{showModel ? 'Hide' : 'Show'} model answer</button>
        {showModel && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{w.modelAnswer}</p>}
      </Card>

      {history.length > 0 && (
        <Card><p className="label">Your previous submissions</p>
          <ul className="mt-2 space-y-1 text-sm">{history.map((h) => <li key={h.uuid}>{new Date(h.at).toLocaleString()} · {h.wordCount} words {h.feedbackSource === 'ai' && '· AI reviewed'}</li>)}</ul>
        </Card>
      )}
    </div>
  )
}

function AiView({ ai }: { ai: AiWritingFeedback }) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      {ai.estimatedLevel && <p>Estimated level of this text: <b>{ai.estimatedLevel}</b> <span className="text-ink-400">(AI estimate, not official)</span></p>}
      <ul className="space-y-2">{ai.errors.map((e, k) => <li key={k} className="rounded-xl border border-ink-100 p-3 dark:border-ink-800"><span className="chip mb-1 bg-ink-100 dark:bg-ink-800">{e.type}</span><p><span className="text-rose-600 line-through">{e.excerpt}</span> → <b className="text-emerald-700 dark:text-emerald-400">{e.correction}</b></p><p className="text-ink-500">{e.explanation}</p></li>)}</ul>
      <p><b>Vocabulary:</b> {ai.vocabulary}</p>
      <p><b>Coherence:</b> {ai.coherence}</p>
      <p><b>Structure:</b> {ai.structure}</p>
      <div><b>Improved version:</b><p className="mt-1 whitespace-pre-wrap rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">{ai.improvedText}</p></div>
      {ai.advice.length > 0 && <ul className="list-disc pl-5">{ai.advice.map((a) => <li key={a}>{a}</li>)}</ul>}
    </div>
  )
}
