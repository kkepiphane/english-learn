import type { Badge } from './rewards'

/** Draws a square badge card (works offline, on the device) and returns it as a PNG file. */
export async function badgeImage(badge: Badge, name: string, date = new Date()): Promise<File> {
  const S = 1080
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  await document.fonts?.ready
  const font = (w: number, px: number) => `${w} ${px}px "Plus Jakarta Sans Variable", system-ui, sans-serif`
  g.fillStyle = '#0f7f76'
  g.fillRect(0, 0, S, S)
  g.fillStyle = '#1f9d91'
  g.beginPath(); g.arc(S - 120, 140, 260, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#0f6660'
  g.beginPath(); g.arc(120, S - 80, 220, 0, Math.PI * 2); g.fill()
  // Medal
  const cx = S / 2, cy = 400, r = 220
  g.fillStyle = '#d97706'; g.beginPath(); g.arc(cx, cy + 18, r, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#fbbf24'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#fcd34d'; g.beginPath(); g.arc(cx, cy, r * 0.76, 0, Math.PI * 2); g.fill()
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = `${Math.round(r * 0.9)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
  g.fillText(badge.icon, cx, cy + 10)
  // Text
  g.fillStyle = '#ffffff'
  g.font = font(800, 84); g.fillText(badge.title, cx, 735)
  g.fillStyle = '#d3f5ef'
  g.font = font(600, 42); g.fillText(badge.desc, cx, 815)
  g.fillStyle = '#ffffff'
  g.font = font(700, 40); g.fillText(`${name} · ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, cx, 900)
  g.fillStyle = '#fb8068'
  g.font = font(800, 44); g.fillText('English Path', cx, 1000)
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'))
  return new File([blob], `english-path-${badge.id}.png`, { type: 'image/png' })
}

/** Shares the badge image with the phone's share sheet, or downloads it where sharing files isn't supported. */
export async function shareBadge(badge: Badge, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = await badgeImage(badge, name)
  const text = `I just earned the "${badge.title}" badge on English Path! ${badge.desc}.`
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: badge.title })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return 'downloaded'
}
