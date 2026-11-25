import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import clsx from 'clsx'
import { db } from '../db/db'
import { useOnline, useProfile, useTheme } from '../hooks/hooks'
import { badges, earned, type Badge } from '../lib/rewards'
import { celebrate, confetti, setSoundEnabled, sfx } from '../lib/fx'
import { xpLevel } from '../lib/stats'
import { UpdatePrompt } from './UpdatePrompt'

// Speaking lives in Practice, Exams in Learn: five tabs fit comfortably on a phone.
const NAV = [
  { to: '/', label: 'Home', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/learn', label: 'Learn', icon: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14' },
  { to: '/practice', label: 'Practice', icon: 'M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12' },
  { to: '/progress', label: 'Progress', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/profile', label: 'Profile', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
]

const Icon = ({ d, className = 'h-6 w-6' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
)

export function StatusPill() {
  const online = useOnline()
  return (
    <span className={clsx('chip', online ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200')} role="status" aria-live="polite"
      title={online ? 'Online — AI features available if configured' : 'Offline — everything except AI keeps working'}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-500' : 'bg-amber-500')} />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}

/** Celebrates badges the learner has just earned (compared with the ones already shown). */
function BadgeWatcher() {
  const [fresh, setFresh] = useState<Badge[]>([])
  const data = useLiveQuery(async () => ({
    sessions: await db.sessions.toArray(),
    progress: await db.lessonProgress.toArray(),
    cards: await db.cards.toArray(),
    writings: await db.writings.toArray(),
    assessments: await db.assessments.toArray(),
    recordings: await db.recordings.count(),
    seen: (await db.kv.get('badges.seen'))?.value as string[] | undefined,
  }))
  useEffect(() => {
    if (!data) return
    const got = earned(badges(data))
    const seen = new Set(data.seen ?? [])
    const news = got.filter((b) => !seen.has(b.id))
    if (!news.length) return
    void db.kv.put({ key: 'badges.seen', value: got.map((b) => b.id) })
    setFresh(news)
    sfx.unlock()
    confetti(80)
  }, [data])
  useEffect(() => {
    if (!fresh.length) return
    const t = setTimeout(() => setFresh([]), 5000)
    return () => clearTimeout(t)
  }, [fresh])
  if (!fresh.length) return null
  return (
    <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <Link to="/progress" onClick={() => setFresh([])} className="flex max-w-sm animate-pop items-center gap-3 rounded-3xl border border-flame-200 bg-white px-4 py-3 shadow-xl dark:border-flame-900 dark:bg-ink-900">
        <span className="text-3xl animate-wiggle" aria-hidden>{fresh[0].icon}</span>
        <span>
          <span className="block text-xs font-bold uppercase tracking-wider text-flame-600">{fresh.length > 1 ? `${fresh.length} new badges!` : 'New badge!'}</span>
          <span className="block font-display font-bold">{fresh.map((b) => b.title).join(' · ')}</span>
        </span>
      </Link>
    </div>
  )
}

/** Full-screen celebration when the XP level goes up. */
function LevelUpWatcher() {
  const [lvl, setLvl] = useState<number | null>(null)
  const data = useLiveQuery(async () => ({
    xp: (await db.sessions.toArray()).reduce((a, s) => a + s.xp, 0),
    seen: (await db.kv.get('xp.level'))?.value as number | undefined,
  }))
  useEffect(() => {
    if (!data) return
    const cur = xpLevel(data.xp).lvl
    if (data.seen === undefined || cur < data.seen) return void db.kv.put({ key: 'xp.level', value: cur })
    if (cur > data.seen) {
      void db.kv.put({ key: 'xp.level', value: cur })
      setLvl(cur)
      celebrate()
    }
  }, [data])
  if (lvl === null) return null
  return (
    <div className="fixed inset-0 z-50 flex animate-fadein items-center justify-center bg-ink-950/70 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="lvl-h" onClick={() => setLvl(null)}>
      <div className="w-full max-w-xs animate-zoomin rounded-[2rem] bg-white p-6 text-center shadow-2xl dark:bg-ink-900">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-flame-100 shadow-[0_6px_0_0_theme(colors.flame.300)] dark:bg-flame-900/40">
          <span className="animate-flicker text-6xl" aria-hidden>⭐</span>
        </div>
        <p className="mt-5 text-xs font-extrabold uppercase tracking-widest text-flame-600">Level up!</p>
        <p id="lvl-h" className="font-display text-5xl font-extrabold">Level {lvl}</p>
        <p className="mt-2 text-sm text-ink-500">Your English is growing every day. Keep the fire going.</p>
        <button className="btn-primary mt-5 w-full py-3" autoFocus onClick={() => setLvl(null)}>Keep going →</button>
      </div>
    </div>
  )
}

export function Layout() {
  useTheme()
  const profile = useProfile()
  useEffect(() => void setSoundEnabled(profile?.sound ?? true), [profile?.sound])
  const { pathname } = useLocation()
  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">Skip to content</a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-ink-100 bg-white px-3 py-5 dark:border-ink-800 dark:bg-ink-900 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-9 w-9" />
          <span className="font-display text-xl font-extrabold tracking-tight">English Path</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => clsx('flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-semibold transition', isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200' : 'text-ink-500 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800')}>
              <Icon d={n.icon} className="h-5 w-5" />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-2"><StatusPill /></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between bg-ink-50/85 px-4 pb-2.5 pt-[max(env(safe-area-inset-top),0.625rem)] backdrop-blur dark:bg-ink-950/85 md:hidden">
          <span className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />English Path</span>
          <StatusPill />
        </div>
        <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-8">
          <div key={pathname} className="animate-rise"><Outlet /></div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-ink-100 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-ink-800 dark:bg-ink-950/95 md:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => clsx('group flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', isActive ? 'text-brand-600 dark:text-brand-300' : 'text-ink-400')}>
            {({ isActive }) => (<>
              <span className={clsx('flex h-8 w-14 items-center justify-center rounded-full transition', isActive && 'bg-brand-100 dark:bg-brand-900/60')}><Icon d={n.icon} /></span>
              {n.label}
            </>)}
          </NavLink>
        ))}
      </nav>
      <BadgeWatcher />
      <LevelUpWatcher />
      <UpdatePrompt />
    </div>
  )
}
