import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { db } from '../db/db'
import { useOnline, useProfile } from '../hooks/hooks'
import { Card, PageTitle, Notice } from '../components/ui'
import { saveProfile } from '../lib/repo'
import { downloadBackup, restoreBackup, type RestoreMode } from '../lib/backup'
import { aiHealth, getAiConfig, setAiConfig } from '../lib/ai'
import type { Level } from '../content/types'

export default function Profile() {
  const p = useProfile()
  if (!p) return null
  const set = (patch: Parameters<typeof saveProfile>[0]) => void saveProfile(patch)
  return (
    <div className="space-y-4">
      <PageTitle title="Profile" subtitle="Settings, backups and privacy" />
      <Card className="space-y-4">
        <label className="block"><span className="label">Name</span><input className="input mt-1" defaultValue={p.name} onBlur={(e) => set({ name: e.target.value.trim() || 'Learner' })} /></label>
        <div><span className="label">Goal level</span><div className="mt-1"><Seg label="Goal" value={p.goalLevel} options={(['B1', 'B2', 'C1'] as Level[]).map((l) => [l, l])} onChange={(v) => set({ goalLevel: v })} /></div></div>
        <div><span className="label">Exam</span><div className="mt-1"><Seg label="Exam" value={p.exam} options={[['ielts', 'IELTS'], ['toefl', 'TOEFL'], ['none', 'None']]} onChange={(v) => set({ exam: v })} /></div></div>
        <div><span className="label">Daily goal</span><div className="mt-1"><Seg label="Daily goal" value={p.dailyGoalMin} options={[10, 20, 30, 45, 60].map((m) => [m, `${m} min`])} onChange={(v) => set({ dailyGoalMin: v })} /></div></div>
        <div><span className="label">Theme</span><div className="mt-1"><Seg label="Theme" value={p.theme} options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} onChange={(v) => set({ theme: v })} /></div></div>
        <label className="flex items-center justify-between gap-3"><span><span className="block font-medium">French support</span><span className="text-sm text-ink-500">Show French explanations and translations. Turn it off as your English grows.</span></span>
          <input type="checkbox" className="h-5 w-5" checked={p.uiFrench} onChange={(e) => set({ uiFrench: e.target.checked })} /></label>
        <Link to="/placement" className="btn-ghost">Retake the level test</Link>
      </Card>
      <BackupCard />
      <AiCard />
      <PrivacyCard />
      <p className="text-center text-xs text-ink-400">English Path · v{__APP_VERSION__} · all data stored on this device</p>
    </div>
  )
}

function BackupCard() {
  const last = useLiveQuery(() => db.kv.get('backup.last'), [])
  const [audio, setAudio] = useState(true)
  const [mode, setMode] = useState<RestoreMode>('merge')
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const restore = async (f: File) => {
    try {
      if (mode === 'replace' && !confirm('Replace ALL data on this device with the backup?')) return
      const c = await restoreBackup(JSON.parse(await f.text()), mode)
      setMsg({ tone: 'ok', text: `Restored: ${c.attempts ?? 0} answers, ${c.cards ?? 0} cards, ${c.recordings ?? 0} recordings.` })
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message })
    }
  }
  return (
    <Card>
      <h2 className="font-bold">Backup & restore</h2>
      <p className="mt-1 text-sm text-ink-500">Your data lives only in this browser. Export a backup regularly, and use it to move to another device.</p>
      {last?.value ? <p className="mt-1 text-xs text-ink-400">Last export: {new Date(last.value as number).toLocaleString()}</p> : <p className="mt-1 text-xs text-amber-700">No backup exported yet.</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={() => void downloadBackup(audio)}>Export backup</button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} /> include voice recordings</label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="btn-ghost cursor-pointer">Import backup…<input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void restore(f) }} /></label>
        <select className="input w-auto py-1.5 text-sm" value={mode} onChange={(e) => setMode(e.target.value as RestoreMode)} aria-label="Restore mode">
          <option value="merge">Merge with this device</option>
          <option value="replace">Replace this device's data</option>
        </select>
      </div>
      {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
    </Card>
  )
}

function AiCard() {
  const online = useOnline()
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [configured, setConfigured] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null)
  useEffect(() => void getAiConfig().then((c) => { setUrl(c?.proxyUrl ?? ''); setConfigured(!!c) }), [])
  const save = async () => {
    try {
      await setAiConfig(url ? { proxyUrl: url.trim(), accessToken: token.trim() || undefined } : null)
      setConfigured(!!url)
      setToken('')
      setMsg({ tone: 'ok', text: url ? 'Saved. Use “Test connection” to check it.' : 'AI disabled.' })
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message })
    }
  }
  const test = async () => {
    try {
      const h = await aiHealth()
      setMsg({ tone: 'ok', text: `Connected — provider: ${h.provider}${h.model ? ` (${h.model})` : ''}.` })
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message })
    }
  }
  return (
    <Card>
      <div className="flex items-center justify-between"><h2 className="font-bold">AI tutor (optional)</h2><span className={clsx('chip', configured ? 'bg-emerald-100 text-emerald-800' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>{configured ? 'configured' : 'not configured'}</span></div>
      <p className="mt-1 text-sm text-ink-500">AI features need Internet and your own <b>AI proxy</b> (for example a free Cloudflare Worker — see the README). Your OpenAI / Anthropic key stays in the proxy. <b>Never paste a provider API key here.</b></p>
      <label className="mt-3 block"><span className="label">Proxy URL</span><input className="input mt-1" placeholder="https://english-path-ai.your-name.workers.dev" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" /></label>
      <label className="mt-3 block"><span className="label">Proxy access token (optional)</span><input className="input mt-1" type="password" placeholder={configured ? '•••••• (unchanged)' : 'shared secret that protects your proxy'} value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" /></label>
      {/^sk-|^sk_ant|^AIza/.test(token) && <Notice tone="error">This looks like a provider API key. Do not put it here: put it in your proxy's secrets.</Notice>}
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" onClick={() => void save()} disabled={/^sk-|^sk_ant|^AIza/.test(token)}>Save</button>
        {configured && <button className="btn-ghost" onClick={() => void test()} disabled={!online}>Test connection</button>}
      </div>
      {!online && <p className="mt-2 text-xs text-amber-700">Offline: AI features are paused. Everything else keeps working.</p>}
      {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
    </Card>
  )
}

function PrivacyCard() {
  const counts = useLiveQuery(async () => ({ rec: await db.recordings.count(), att: await db.attempts.count() }), [])
  const [est, setEst] = useState<string>('')
  useEffect(() => void navigator.storage?.estimate?.().then((e) => setEst(`${((e.usage ?? 0) / 1e6).toFixed(1)} MB used`)), [counts])
  const wipe = async () => {
    if (!confirm('Delete ALL your English Path data on this device? Export a backup first if you want to keep it.')) return
    await db.delete()
    location.reload()
  }
  return (
    <Card>
      <h2 className="font-bold">Privacy & data</h2>
      <ul className="mt-2 space-y-1 text-sm text-ink-600 dark:text-ink-300">
        <li>• No account, no server: nothing leaves this device unless you export it or use the AI tutor.</li>
        <li>• {counts?.rec ?? 0} voice recordings · {counts?.att ?? 0} recorded answers {est && `· ${est}`}</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => void db.kv.delete('consent.mic')}>Withdraw microphone consent</button>
        <button className="btn-ghost text-rose-600" disabled={!counts?.rec} onClick={() => confirm('Delete all voice recordings?') && void db.recordings.clear()}>Delete recordings</button>
        <button className="btn bg-rose-600 text-white" onClick={() => void wipe()}>Delete all data</button>
      </div>
    </Card>
  )
}

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>{options.map(([v, l]) => <button key={String(v)} aria-pressed={v === value} onClick={() => onChange(v)} className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium', v === value ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800')}>{l}</button>)}</div>
  )
}
