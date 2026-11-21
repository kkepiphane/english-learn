import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { speak, ttsAvailable } from '../lib/tts'

export const Card = ({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('card p-4 sm:p-5', className)} {...p}>{children}</div>
)

export const PageTitle = ({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: string; right?: ReactNode }) => (
  <header className="mb-5 flex items-start justify-between gap-3">
    <div>
      {back && <Link to={back} className="mb-1 inline-block text-sm font-medium text-brand-600 dark:text-brand-400">← Back</Link>}
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
    </div>
    {right}
  </header>
)

export const Bar = ({ value, className, color = 'bg-brand-600', label }: { value: number; className?: string; color?: string; label?: string }) => (
  <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
    <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
)

export function Ring({ value, size = 88, stroke = 9, children, label }: { value: number; size?: number; stroke?: number; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(value)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-ink-100 dark:stroke-ink-800" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeLinecap="round" className="fill-none stroke-brand-600 transition-all duration-700" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value / 100))} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

export const LevelBadge = ({ level, className }: { level: string | null | undefined; className?: string }) => (
  <span className={clsx('chip bg-brand-600 font-bold text-white', className)}>{level ?? '—'}</span>
)

export function SpeakButton({ text, rate, className, label = 'Listen' }: { text: string; rate?: number; className?: string; label?: string }) {
  if (!ttsAvailable()) return null
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); speak(text, { rate }) }} className={clsx('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-300', className)} aria-label={`${label}: ${text}`} title={label}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" /></svg>
    </button>
  )
}

export const Notice = ({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok' | 'error'; children: ReactNode }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={clsx('rounded-xl border px-3.5 py-3 text-sm', {
    'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-900/30 dark:text-brand-100': tone === 'info',
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-100': tone === 'warn',
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100': tone === 'ok',
    'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-900/30 dark:text-rose-100': tone === 'error',
  })}>{children}</div>
)

/** French helper text, shown only when the learner keeps French support on. */
export const Fr = ({ children, show }: { children: ReactNode; show: boolean }) =>
  show ? <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-sm italic text-ink-600 dark:bg-ink-800/60 dark:text-ink-300"><span className="mr-1 not-italic">🇫🇷</span>{children}</p> : null

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-8 text-center text-sm text-ink-400">{children}</p>
