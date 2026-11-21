import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uuid, today } from '../db/db'
import { Card, PageTitle, Notice, SpeakButton } from '../components/ui'
import { useOnline, useStudyTimer } from '../hooks/hooks'
import { aiStatus, type AiStatus } from '../lib/ai'
import { addXp } from '../lib/repo'

const TOPICS = [
  { t: 'Introduce yourself.', tips: ['Name and where you live', 'What you do', 'One hobby', 'Why you learn English'] },
  { t: 'Describe your daily routine.', tips: ['Morning, afternoon, evening', 'Use usually / always / sometimes', 'One thing that is different this week'] },
  { t: 'Talk about your professional experience.', tips: ['Your current job', 'A past job (past simple)', 'What you have learned (present perfect)'] },
  { t: 'Explain your career goals.', tips: ['Short-term goal (going to)', 'Long-term goal (I\'d like to…)', 'Why'] },
  { t: 'Describe a difficult situation you solved.', tips: ['What happened', 'What you did', 'The result and the lesson'] },
  { t: 'What do you think about artificial intelligence?', tips: ['Your opinion', 'One advantage, one risk', 'An example', 'A conclusion'] },
  { t: 'Describe a place you would like to visit.', tips: ['Where and why', 'What you would do there (would)', 'Who you would go with'] },
]

const MAX_SEC = 180

export default function Speaking() {
  useStudyTimer()
  const online = useOnline()
  const [ai, setAi] = useState<AiStatus>('not-configured')
  useEffect(() => void aiStatus().then(setAi), [online])
  const dayIndex = Math.floor(new Date(today()).getTime() / 86_400_000) % TOPICS.length
  const [topicIdx, setTopicIdx] = useState(dayIndex)
  const topic = TOPICS[topicIdx]
  const consent = useLiveQuery(() => db.kv.get('consent.mic'), [])
  const recordings = useLiveQuery(() => db.recordings.orderBy('at').reverse().toArray(), [], [])
  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  return (
    <div className="space-y-4">
      <PageTitle back="/practice" title="Speaking" subtitle="Speak every day. Record yourself, listen back, improve." />
      <Card>
        <div className="flex items-center justify-between gap-2"><p className="label">Daily speaking · 1–3 minutes</p>
          <button className="text-sm font-medium text-brand-600 dark:text-brand-400" onClick={() => setTopicIdx((topicIdx + 1) % TOPICS.length)}>Another topic ↻</button></div>
        <div className="mt-2 flex items-center gap-2"><SpeakButton text={topic.t} /><p className="text-xl font-semibold">{topic.t}</p></div>
        <ul className="mt-2 flex flex-wrap gap-1.5">{topic.tips.map((t) => <li key={t} className="chip bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">{t}</li>)}</ul>
        <div className="mt-4">
          {!supported ? <Notice tone="warn">Audio recording is not supported in this browser. Try Chrome, Edge, Firefox or Safari 14.5+.</Notice>
            : !consent?.value ? <Consent /> : <Recorder topic={topic.t} />}
        </div>
      </Card>

      {recordings.length > 0 && (
        <Card>
          <div className="flex items-center justify-between"><p className="label">Your recordings (stored only on this device)</p>
            <button className="text-sm text-rose-600" onClick={() => confirm('Delete all recordings from this device?') && void db.recordings.clear()}>Delete all</button></div>
          <ul className="mt-2 divide-y divide-ink-100 dark:divide-ink-800">
            {recordings.map((r) => <RecordingRow key={r.uuid} r={r} />)}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="font-semibold">AI English Tutor & speech feedback</p><p className="text-sm text-ink-500">Conversation practice, pronunciation analysis and spoken feedback.</p></div>
          <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">needs Internet · Phase 2</span>
        </div>
        <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">
          {ai === 'not-configured' ? 'Not available yet: no AI proxy is configured, and the conversation module arrives in Phase 2. For now, record yourself, listen back, and compare with the tips above.' : 'Your AI proxy is configured. The conversation and speech-analysis screens arrive in Phase 2.'}
        </p>
        <p className="mt-2 text-xs text-ink-400">Self-check while listening: Did I answer the question? Did I speak for at least 1 minute? Did I use linking words? Which words did I hesitate on?</p>
      </Card>
    </div>
  )
}

function Consent() {
  return (
    <div className="rounded-xl bg-ink-50 p-4 text-sm dark:bg-ink-800/60">
      <p className="font-semibold">Before recording</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-600 dark:text-ink-300">
        <li>Your browser will ask for microphone access.</li>
        <li>Recordings stay on this device (IndexedDB). Nothing is uploaded.</li>
        <li>You can delete them at any time. They are included in backups only if you choose.</li>
      </ul>
      <button className="btn-primary mt-3" onClick={() => void db.kv.put({ key: 'consent.mic', value: Date.now() })}>I agree — enable recording</button>
    </div>
  )
}

function Recorder({ topic }: { topic: string }) {
  const [state, setState] = useState<'idle' | 'recording' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [sec, setSec] = useState(0)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const started = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(() => () => { clearInterval(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()) }, [])

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? ''
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        clearInterval(timer.current)
        const dur = Math.round((Date.now() - started.current) / 1000)
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' })
        await db.recordings.add({ uuid: uuid(), topic, at: Date.now(), durationSec: dur, blob, mime: blob.type })
        if (dur >= 60) await addXp(30)
        setState('idle')
        setSec(0)
      }
      rec.current = r
      r.start(1000)
      started.current = Date.now()
      setState('recording')
      timer.current = setInterval(() => {
        const s = Math.round((Date.now() - started.current) / 1000)
        setSec(s)
        if (s >= MAX_SEC) r.stop()
      }, 250)
    } catch (e) {
      setState('error')
      setErr((e as Error).name === 'NotAllowedError' ? 'Microphone access was refused. Allow it in your browser settings, then try again.' : (e as Error).message)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {state !== 'recording' ? (
        <button className="btn-primary" onClick={() => void start()}>● Record</button>
      ) : (
        <button className="btn bg-rose-600 text-white" onClick={() => rec.current?.stop()}>■ Stop</button>
      )}
      {state === 'recording' && (
        <span className="flex items-center gap-2 text-sm tabular-nums" aria-live="polite">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
          {Math.floor(sec / 60)}:{`${sec % 60}`.padStart(2, '0')} / 3:00 {sec < 60 && <span className="text-ink-400">— aim for at least 1 minute</span>}
        </span>
      )}
      {state === 'error' && <Notice tone="error">{err}</Notice>}
    </div>
  )
}

function RecordingRow({ r }: { r: { uuid: string; topic: string; at: number; durationSec: number; blob: Blob } }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(r.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [r.blob])
  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{r.topic}</span>
        <span className="text-ink-400">{new Date(r.at).toLocaleDateString()} · {Math.floor(r.durationSec / 60)}:{`${r.durationSec % 60}`.padStart(2, '0')}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        {url && <audio controls src={url} className="h-9 w-full" preload="metadata" />}
        <button className="text-sm text-rose-600" onClick={() => void db.recordings.delete(r.uuid)} aria-label="Delete recording">Delete</button>
      </div>
    </li>
  )
}
