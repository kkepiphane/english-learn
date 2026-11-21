/**
 * English Path — AI proxy (optional), for Cloudflare Workers (free plan is enough for personal use).
 *
 * Why a proxy? GitHub Pages is public and static: an API key placed in the app would be readable by anyone.
 * This Worker keeps the provider key as an encrypted secret and exposes a small, stable contract to the app:
 *
 *   GET  /v1/health
 *   POST /v1/writing-feedback  { text, task, level }      -> structured feedback (JSON)
 *   POST /v1/chat              { messages, level, mode }  -> { reply }
 *
 * Provider-agnostic: set PROVIDER = "openai" or "anthropic" (add others in callModel()).
 *
 * Secrets / variables (wrangler secret put …  or Cloudflare dashboard):
 *   PROVIDER          openai | anthropic
 *   OPENAI_API_KEY    if PROVIDER=openai
 *   ANTHROPIC_API_KEY if PROVIDER=anthropic
 *   MODEL             model name for your provider (required, e.g. the current small/cheap model)
 *   ACCESS_TOKEN      a long random string; paste the same value in the app (Profile → AI tutor)
 *   ALLOWED_ORIGIN    https://<your-user>.github.io   (CORS: only your app can call the proxy)
 */

const MAX_TEXT = 6000
const MAX_MESSAGES = 30

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const allowed = env.ALLOWED_ORIGIN || ''
    const cors = {
      'Access-Control-Allow-Origin': allowed || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

    if (allowed && origin && origin !== allowed) return json({ error: 'Origin not allowed' }, 403)
    if (env.ACCESS_TOKEN && request.headers.get('Authorization') !== `Bearer ${env.ACCESS_TOKEN}`) return json({ error: 'Unauthorized' }, 401)

    const url = new URL(request.url)
    try {
      if (url.pathname === '/v1/health') return json({ ok: true, provider: env.PROVIDER, model: env.MODEL })

      if (request.method !== 'POST') return json({ error: 'Not found' }, 404)
      const body = await request.json()

      if (url.pathname === '/v1/writing-feedback') {
        const text = String(body.text || '').slice(0, MAX_TEXT)
        if (text.split(/\s+/).length < 5) return json({ error: 'Text too short' }, 400)
        const system = `You are an expert English teacher for French-speaking learners preparing IELTS/TOEFL.
The learner's target level is ${String(body.level || 'B1')}. Correct the text and TEACH: explain every error simply (in English, add a short French hint in brackets when useful).
Do not just rewrite. Return ONLY valid JSON with this exact shape:
{"correctedText": string, "improvedText": string,
 "errors": [{"excerpt": string, "correction": string, "type": "grammar"|"spelling"|"vocabulary"|"style"|"coherence", "explanation": string}],
 "vocabulary": string, "coherence": string, "structure": string, "estimatedLevel": "A2"|"B1"|"B2"|"C1", "advice": [string]}`
        const out = await callModel(env, system, [{ role: 'user', content: `Task: ${String(body.task || '').slice(0, 800)}\n\nLearner text:\n${text}` }], true)
        return json(parseJson(out))
      }

      if (url.pathname === '/v1/chat') {
        const mode = ['beginner', 'intermediate', 'advanced'].includes(body.mode) ? body.mode : 'intermediate'
        const style = { beginner: 'Use simple, short sentences and common words.', intermediate: 'Use natural B1/B2 English.', advanced: 'Use academic and professional English.' }[mode]
        const system = `You are a friendly English tutor. Speak only English. Learner level: ${String(body.level || 'B1')}. ${style}
Ask one question at a time and encourage developed answers. Do not interrupt with corrections: at the end of your reply, add a short "Feedback:" line only if there was an important mistake, with a more natural formulation.`
        const messages = (Array.isArray(body.messages) ? body.messages : [])
          .slice(-MAX_MESSAGES)
          .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 2000) }))
        return json({ reply: await callModel(env, system, messages, false) })
      }

      return json({ error: 'Not found' }, 404)
    } catch (e) {
      return json({ error: String(e && e.message ? e.message : e) }, 502)
    }
  },
}

async function callModel(env, system, messages, wantJson) {
  if (!env.MODEL) throw new Error('MODEL is not set on the proxy')
  if (env.PROVIDER === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.MODEL, max_tokens: 2000, system, messages }),
    })
    if (!r.ok) throw new Error(`Provider error ${r.status}`)
    const d = await r.json()
    return d.content.map((c) => c.text || '').join('')
  }
  if (env.PROVIDER === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.MODEL, messages: [{ role: 'system', content: system }, ...messages], ...(wantJson ? { response_format: { type: 'json_object' } } : {}) }),
    })
    if (!r.ok) throw new Error(`Provider error ${r.status}`)
    const d = await r.json()
    return d.choices[0].message.content
  }
  throw new Error('Unknown PROVIDER (use "openai" or "anthropic")')
}

function parseJson(s) {
  const m = String(s).match(/\{[\s\S]*\}/)
  if (!m) throw new Error('The model did not return JSON')
  const o = JSON.parse(m[0])
  o.errors = Array.isArray(o.errors) ? o.errors : []
  o.advice = Array.isArray(o.advice) ? o.advice : []
  return o
}
