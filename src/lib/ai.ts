import { db } from '../db/db'

/**
 * AI service layer — provider-agnostic.
 *
 * The browser NEVER holds an OpenAI/Anthropic/… API key. AI calls go to an *AI proxy* that the
 * learner deploys themselves (template in /ai-proxy, e.g. a free Cloudflare Worker). The proxy holds
 * the provider key as a secret and exposes a tiny, stable contract:
 *
 *   POST {proxyUrl}/v1/writing-feedback   { text, task, level }        -> AiWritingFeedback
 *   POST {proxyUrl}/v1/chat               { messages, level, mode }    -> { reply }
 *   GET  {proxyUrl}/v1/health                                          -> { ok, provider }
 *
 * Swapping provider = changing the proxy's env vars. The app does not change.
 * If no proxy is configured, or the device is offline, AI features are reported as unavailable
 * and the offline features keep working.
 */

export interface AiConfig {
  proxyUrl: string
  /** Optional shared token so that only you can use your proxy. Not a provider API key. */
  accessToken?: string
}

export type AiStatus = 'not-configured' | 'offline' | 'ready' | 'error'

export interface AiWritingFeedback {
  correctedText: string
  improvedText: string
  errors: { excerpt: string; correction: string; type: string; explanation: string }[]
  vocabulary: string
  coherence: string
  structure: string
  estimatedLevel?: string
  advice: string[]
}

export async function getAiConfig(): Promise<AiConfig | null> {
  const url = (await db.kv.get('ai.proxyUrl'))?.value as string | undefined
  if (!url) return null
  const token = (await db.kv.get('secret.ai.accessToken'))?.value as string | undefined
  return { proxyUrl: url.replace(/\/$/, ''), accessToken: token }
}

export async function setAiConfig(cfg: AiConfig | null) {
  if (!cfg || !cfg.proxyUrl) {
    await db.kv.bulkDelete(['ai.proxyUrl', 'secret.ai.accessToken'])
    return
  }
  if (!/^https:\/\//.test(cfg.proxyUrl)) throw new Error('The proxy URL must start with https://')
  await db.kv.put({ key: 'ai.proxyUrl', value: cfg.proxyUrl.replace(/\/$/, '') })
  if (cfg.accessToken) await db.kv.put({ key: 'secret.ai.accessToken', value: cfg.accessToken })
  else await db.kv.delete('secret.ai.accessToken')
}

export async function aiStatus(): Promise<AiStatus> {
  const cfg = await getAiConfig()
  if (!cfg) return 'not-configured'
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'
  return 'ready'
}

async function call<T>(path: string, body?: unknown, timeoutMs = 45_000): Promise<T> {
  const cfg = await getAiConfig()
  if (!cfg) throw new Error('AI is not configured. Add your AI proxy in Profile → AI.')
  if (!navigator.onLine) throw new Error('You are offline. AI features need an Internet connection.')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(cfg.proxyUrl + path, {
      method: body ? 'POST' : 'GET',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(cfg.accessToken ? { Authorization: `Bearer ${cfg.accessToken}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`AI proxy error ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return (await res.json()) as T
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('The AI took too long to answer. Try again.')
    throw e
  } finally {
    clearTimeout(t)
  }
}

export const aiHealth = () => call<{ ok: boolean; provider: string; model?: string }>('/v1/health', undefined, 10_000)
export const aiWritingFeedback = (text: string, task: string, level: string) =>
  call<AiWritingFeedback>('/v1/writing-feedback', { text, task, level })
export const aiChat = (messages: { role: 'user' | 'assistant'; content: string }[], level: string, mode: 'beginner' | 'intermediate' | 'advanced') =>
  call<{ reply: string }>('/v1/chat', { messages, level, mode })
