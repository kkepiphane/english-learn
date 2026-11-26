/**
 * Small feedback effects: synthesized sounds (Web Audio, no files to download, works offline),
 * short vibrations and a canvas confetti burst. All of them are optional and fail silently.
 */

let soundOn = true
export const setSoundEnabled = (on: boolean) => (soundOn = on)

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

let ctx: AudioContext | null = null
function audio() {
  if (!soundOn || typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx ??= new AC()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Plays a sequence of [frequency Hz, start s, duration s] notes. */
function notes(seq: [number, number, number][], type: OscillatorType = 'sine', volume = 0.12) {
  const a = audio()
  if (!a) return
  const t0 = a.currentTime
  for (const [f, start, dur] of seq) {
    const o = a.createOscillator(), g = a.createGain()
    o.type = type
    o.frequency.value = f
    g.gain.setValueAtTime(0, t0 + start)
    g.gain.linearRampToValueAtTime(volume, t0 + start + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur)
    o.connect(g).connect(a.destination)
    o.start(t0 + start)
    o.stop(t0 + start + dur + 0.02)
  }
}

const vibrate = (p: number | number[]) => {
  try { navigator.vibrate?.(p) } catch { /* not supported */ }
}

export const sfx = {
  correct() { notes([[660, 0, 0.12], [990, 0.08, 0.2]], 'triangle'); vibrate(15) },
  wrong() { notes([[220, 0, 0.18], [180, 0.1, 0.22]], 'sine', 0.08); vibrate([30, 40, 30]) },
  combo() { notes([[784, 0, 0.1], [988, 0.07, 0.1], [1319, 0.14, 0.22]], 'triangle'); vibrate(25) },
  complete() { notes([[523, 0, 0.16], [659, 0.12, 0.16], [784, 0.24, 0.16], [1047, 0.36, 0.4]], 'triangle'); vibrate([20, 40, 60]) },
  unlock() { notes([[880, 0, 0.12], [1175, 0.1, 0.12], [1568, 0.2, 0.35]], 'sine', 0.1); vibrate(40) },
}

const COLORS = ['#1f9d91', '#71d6c8', '#f4614a', '#ffa592', '#fbbf24', '#fcd34d', '#0f7f76']

/** Fullscreen confetti burst; removes its own canvas when done. */
export function confetti(pieces = 120) {
  if (typeof document === 'undefined' || reducedMotion()) return
  const c = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = window.innerWidth, H = window.innerHeight
  c.width = W * dpr
  c.height = H * dpr
  c.setAttribute('aria-hidden', 'true')
  Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '60' })
  document.body.appendChild(c)
  const g = c.getContext('2d')
  if (!g) return c.remove()
  g.scale(dpr, dpr)
  const ps = Array.from({ length: pieces }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 6,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }))
  const start = performance.now()
  const frame = (t: number) => {
    const age = t - start
    g.clearRect(0, 0, W, H)
    for (const p of ps) {
      p.vy += 0.35
      p.vx *= 0.99
      p.x += p.vx
      p.y += p.vy
      p.r += p.vr
      g.save()
      g.globalAlpha = Math.max(0, 1 - age / 2600)
      g.translate(p.x, p.y)
      g.rotate(p.r)
      g.fillStyle = p.color
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)))
      g.restore()
    }
    if (age < 2600) requestAnimationFrame(frame)
    else c.remove()
  }
  requestAnimationFrame(frame)
}

export function celebrate() {
  sfx.complete()
  confetti()
}
