import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { useOnline, useTheme } from '../hooks/hooks'
import { UpdatePrompt } from './UpdatePrompt'

const NAV = [
  { to: '/', label: 'Home', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/learn', label: 'Learn', icon: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7' },
  { to: '/speaking', label: 'Speaking', icon: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3' },
  { to: '/practice', label: 'Practice', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/exams', label: 'Exams', icon: 'M9 4h6l1 3h4v13H4V7h4zM9 13l2 2 4-4' },
  { to: '/progress', label: 'Progress', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/profile', label: 'Profile', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
]

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
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

export function Layout() {
  useTheme()
  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">Skip to content</a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-ink-100 bg-white px-3 py-5 dark:border-ink-800 dark:bg-ink-900 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight">English Path</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800')}>
              <Icon d={n.icon} />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-2"><StatusPill /></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-100 bg-white/85 px-4 pb-2.5 pt-[max(env(safe-area-inset-top),0.625rem)] backdrop-blur dark:border-ink-800 dark:bg-ink-950/85 md:hidden">
          <span className="flex items-center gap-2 font-bold"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-6 w-6" />English Path</span>
          <StatusPill />
        </div>
        <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10 md:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-7 border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-ink-800 dark:bg-ink-950/95 md:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium', isActive ? 'text-brand-600 dark:text-brand-400' : 'text-ink-400')}>
            <Icon d={n.icon} />{n.label}
          </NavLink>
        ))}
      </nav>
      <UpdatePrompt />
    </div>
  )
}
