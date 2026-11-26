import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ShareNetwork, X } from '@phosphor-icons/react'
import type { Badge } from '../lib/rewards'
import { shareBadge } from '../lib/share'
import { useProfile } from '../hooks/hooks'
import { Medal } from './Medal'
import { Bar } from './ui'

/** Full-screen badge view: 3D medal, description, progress or share button. */
export function BadgeModal({ badge, isNew = false, more = 0, onClose }: { badge: Badge; isNew?: boolean; more?: number; onClose: () => void }) {
  const name = useProfile()?.name ?? 'I'
  const [msg, setMsg] = useState('')
  const earned = badge.value >= badge.target
  const share = async () => {
    const r = await shareBadge(badge, name)
    setMsg(r === 'downloaded' ? 'Image saved: share it from your gallery.' : r === 'shared' ? 'Shared!' : '')
  }
  // Rendered in <body>: an animated (transformed) parent would otherwise trap the "fixed" overlay
  // inside the page, so it appeared off-screen and needed scrolling.
  return createPortal(
    <div className="fixed inset-0 z-50 flex animate-fadein items-center justify-center bg-ink-950/70 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="badge-h" onClick={onClose}>
      <div className="relative w-full max-w-xs animate-zoomin rounded-[2rem] bg-white p-6 text-center shadow-2xl dark:bg-ink-900" onClick={(e) => e.stopPropagation()}>
        <button className="absolute right-4 top-4 text-ink-400" onClick={onClose} aria-label="Close"><X size={22} weight="bold" /></button>
        {isNew && <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-flame-600">{more ? `New badge! +${more} more` : 'New badge!'}</p>}
        <Medal icon={badge.icon} locked={!earned} back={badge.title} spin={isNew} />
        <p id="badge-h" className="mt-6 font-display text-2xl font-extrabold">{badge.title}</p>
        <p className="mt-1 text-sm text-ink-500">{badge.desc}</p>
        {(badge.times ?? 0) > 1 && <p className="mt-2 inline-block rounded-full bg-sun-100 px-3 py-1 text-xs font-extrabold text-sun-900 dark:bg-sun-900/40 dark:text-sun-300">Won ×{badge.times}</p>}
        {earned ? (
          <>
            <p className="mt-1 text-xs text-ink-400">Tap the medal to flip it</p>
            <button className="btn-cta mt-5 w-full py-3" onClick={() => void share()} autoFocus><ShareNetwork size={20} aria-hidden /> Share</button>
            {msg && <p className="mt-2 text-xs text-ink-500" role="status">{msg}</p>}
          </>
        ) : (
          <div className="mt-4">
            <Bar value={(badge.value / badge.target) * 100} className="h-3" color="bg-sun-400" label={`${badge.value} of ${badge.target}`} />
            <p className="mt-1 text-sm font-bold tabular-nums">{badge.value} / {badge.target}</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
