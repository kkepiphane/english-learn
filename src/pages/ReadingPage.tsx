import { useState } from 'react'
import { X } from '@phosphor-icons/react'
import { useParams } from 'react-router-dom'
import { READINGS } from '../content'
import { Card, PageTitle, SpeakButton, Notice } from '../components/ui'
import { ExerciseRunner, ResultsSummary, type RunnerResult } from '../components/ExerciseRunner'
import { addCards, addXp, recordAttempt } from '../lib/repo'
import { XP } from '../lib/stats'
import { useProfile, useStudyTimer } from '../hooks/hooks'
import type { ReadingText } from '../content/types'

export default function ReadingPage() {
  const { id } = useParams()
  const r = READINGS.find((x) => x.id === id)
  if (!r) return <Notice tone="error">Text not found.</Notice>
  return <Reader key={r.id} r={r} />
}

/** Finds the glossary entry for a clicked word, including multi-word keys ("staying up"). */
const lookup = (r: ReadingText, word: string, next?: string) => {
  const w = word.toLowerCase().replace(/[^a-z'-]/g, '')
  if (next) {
    const two = `${w} ${next.toLowerCase().replace(/[^a-z'-]/g, '')}`
    if (r.glossary[two]) return { key: two, ...r.glossary[two] }
  }
  return r.glossary[w] ? { key: w, ...r.glossary[w] } : null
}

function Reader({ r }: { r: ReadingText }) {
  useStudyTimer()
  const fr = useProfile()?.uiFrench ?? true
  const [sel, setSel] = useState<{ key: string; def: string; fr: string; ipa?: string } | { key: string; def: null } | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<'read' | 'quiz' | 'done'>('read')
  const [results, setResults] = useState<RunnerResult[]>([])
  const [showSummary, setShowSummary] = useState(false)

  const save = async (key: string, def: string, frT: string, ipa?: string) => {
    await addCards([{ id: `${r.level}:read:${key}`, front: key, back: `${def} — ${frT}`, ipa, source: `${r.level}:${r.id}` }])
    setSaved(new Set(saved).add(key))
  }

  return (
    <div>
      <PageTitle back="/practice" title={r.title} subtitle={`${r.level} · ${r.topic}`} />
      {step === 'read' && (
        <>
          <Card className="space-y-4 text-[17px] leading-8">
            <p className="text-xs text-ink-400">Tap a <span className="underline decoration-brand-400 decoration-dotted underline-offset-4">dotted word</span> for its definition, or any word to hear it.</p>
            {r.paragraphs.map((p, k) => {
              const tokens = p.split(/(\s+)/)
              return (
                <p key={k}>
                  {tokens.map((t, i) => {
                    if (/^\s+$/.test(t)) return t
                    const g = lookup(r, t, tokens[i + 2])
                    const inGlossary = !!g
                    return (
                      <button key={i} type="button" onClick={() => setSel(g ?? { key: t.replace(/[^A-Za-z'-]/g, ''), def: null })}
                        className={`rounded px-0.5 text-left hover:bg-brand-50 dark:hover:bg-brand-900/40 ${inGlossary ? 'underline decoration-brand-400 decoration-dotted underline-offset-4' : ''}`}>{t}</button>
                    )
                  })}
                </p>
              )
            })}
          </Card>
          {sel && (
            <div className="sticky bottom-20 z-10 mt-3 md:bottom-4" role="dialog" aria-label={`Definition of ${sel.key}`}>
              <Card className="shadow-lg">
                <div className="flex items-center gap-2"><SpeakButton text={sel.key} /><span className="font-semibold">{sel.key}</span>{'ipa' in sel && sel.ipa && <span className="font-mono text-sm text-ink-400">{sel.ipa}</span>}
                  <button className="ml-auto text-ink-400" onClick={() => setSel(null)} aria-label="Close"><X weight="bold" /></button></div>
                {sel.def ? (
                  <>
                    <p className="mt-1 text-sm">{sel.def}{fr && 'fr' in sel && <span className="text-ink-500"> — {sel.fr}</span>}</p>
                    <button className="btn-ghost mt-2" disabled={saved.has(sel.key)} onClick={() => void save(sel.key, sel.def!, (sel as { fr: string }).fr, (sel as { ipa?: string }).ipa)}>{saved.has(sel.key) ? '✓ Saved to flashcards' : '+ Save word'}</button>
                  </>
                ) : <p className="mt-1 text-sm text-ink-500">Common word — no glossary entry. Tap the speaker to hear it. (A full offline dictionary is planned.)</p>}
              </Card>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <SpeakButton text={r.paragraphs.join(' ')} rate={0.95} label="Read the text aloud" />
            <button className="btn-ghost" onClick={() => setShowSummary(!showSummary)}>{showSummary ? 'Hide summary' : 'Show summary'}</button>
            <button className="btn-primary ml-auto" onClick={() => setStep('quiz')}>Comprehension questions →</button>
          </div>
          {showSummary && <Card className="mt-3 text-sm"><p className="label">Summary</p><p className="mt-1">{r.summary}</p></Card>}
        </>
      )}
      {step === 'quiz' && (
        <Card>
          <ExerciseRunner items={r.questions.map((item) => ({ item }))}
            onAnswer={(x) => recordAttempt({ skill: 'reading', level: r.level, source: 'reading', refId: r.id, itemId: x.item.id, correct: x.correct }).then(() => undefined)}
            onFinish={async (rs) => { await addXp(XP.readingDone); setResults(rs); setStep('done') }} />
        </Card>
      )}
      {step === 'done' && <Card><ResultsSummary results={results}><button className="btn-ghost" onClick={() => setStep('read')}>Read again</button></ResultsSummary></Card>}
    </div>
  )
}
