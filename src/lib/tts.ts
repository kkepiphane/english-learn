/**
 * Text-to-speech through the Web Speech API. On Android/iOS/desktop the OS ships offline voices,
 * so listening exercises work without Internet. Pre-recorded audio (Phase 2) can replace it per item.
 */
export const ttsAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window

let voicesCache: SpeechSynthesisVoice[] = []
function voices(): SpeechSynthesisVoice[] {
  if (!ttsAvailable()) return []
  if (!voicesCache.length) voicesCache = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'))
  return voicesCache
}
if (ttsAvailable()) speechSynthesis.onvoiceschanged = () => (voicesCache = [])

/** Prefer local (offline) voices; alternate voices per speaker so dialogues are easy to follow. */
function voiceFor(speakerIndex: number) {
  const vs = voices()
  const local = vs.filter((v) => v.localService)
  const pool = local.length ? local : vs
  const preferred = pool.filter((v) => /en-(GB|US)/i.test(v.lang))
  const list = preferred.length ? preferred : pool
  return list.length ? list[speakerIndex % list.length] : undefined
}

export function speak(text: string, opts: { rate?: number; speaker?: number; onend?: () => void } = {}) {
  if (!ttsAvailable()) return opts.onend?.()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-GB'
  const v = voiceFor(opts.speaker ?? 0)
  if (v) u.voice = v
  u.rate = opts.rate ?? 1
  u.pitch = (opts.speaker ?? 0) % 2 ? 0.9 : 1.05
  u.onend = () => opts.onend?.()
  u.onerror = () => opts.onend?.()
  speechSynthesis.speak(u)
}

export function speakSequence(lines: { text: string; speaker: number }[], rate = 1, onLine?: (i: number) => void, onDone?: () => void) {
  stop()
  let i = 0
  const next = () => {
    if (i >= lines.length) return onDone?.()
    onLine?.(i)
    const l = lines[i++]
    speak(l.text, { rate, speaker: l.speaker, onend: () => setTimeout(next, 250) })
  }
  next()
}

export const stop = (): void => {
  if (ttsAvailable()) speechSynthesis.cancel()
}
