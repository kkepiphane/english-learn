import { useState } from 'react'
import clsx from 'clsx'

/**
 * A 3D coin: spins in on first render, sways gently, and flips on tap to show its back.
 * Locked medals are flat and grey.
 */
export function Medal({ icon, locked = false, size = 160, back, spin = true }: { icon: string; locked?: boolean; size?: number; back?: string; spin?: boolean }) {
  const [flipped, setFlipped] = useState(false)
  const [intro, setIntro] = useState(spin && !locked)
  return (
    <button type="button" className="medal-scene mx-auto block" style={{ width: size, height: size }} onClick={() => !locked && setFlipped((f) => !f)} aria-label={flipped ? 'Show the front' : 'Flip the medal'} disabled={locked}>
      <div className={clsx('h-full w-full', !locked && !flipped && !intro && 'medal-sway')}>
        <div className={clsx('medal h-full w-full', intro && 'medal-spin')} style={{ transform: flipped ? 'rotateY(180deg)' : undefined }} onAnimationEnd={() => setIntro(false)}>
          <div className={clsx('medal-face', locked ? 'bg-ink-200 grayscale dark:bg-ink-700' : 'bg-sun-400 shadow-[inset_0_-8px_0_0_theme(colors.sun.600),inset_0_8px_0_0_theme(colors.sun.300),0_10px_0_0_theme(colors.sun.600)]')}>
            <span className={clsx('flex items-center justify-center rounded-full', locked ? 'opacity-40' : 'bg-sun-300/60 ring-4 ring-sun-500/40')} style={{ width: size * 0.74, height: size * 0.74, fontSize: size * 0.4 }} aria-hidden>{icon}</span>
          </div>
          <div className="medal-face medal-back bg-brand-600 text-center text-white shadow-[inset_0_-8px_0_0_theme(colors.brand.800),0_10px_0_0_theme(colors.brand.800)]">
            <span className="px-4 font-display text-sm font-extrabold leading-tight">{back ?? 'English Path'}</span>
          </div>
        </div>
      </div>
    </button>
  )
}
