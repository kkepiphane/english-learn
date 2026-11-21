import type { Exercise } from '../content/types'

export type Answer = number | string | boolean | null

/** Normalise free text so that harmless differences (case, curly quotes, extra spaces, final dot) are not penalised. */
export const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[.!?]+$/g, '')

/** Accept common contraction variants: "don't" == "do not". */
const expand = (s: string) =>
  normalise(s)
    .replace(/\bdon't\b/g, 'do not')
    .replace(/\bdoesn't\b/g, 'does not')
    .replace(/\bdidn't\b/g, 'did not')
    .replace(/\bisn't\b/g, 'is not')
    .replace(/\baren't\b/g, 'are not')
    .replace(/\bwasn't\b/g, 'was not')
    .replace(/\bweren't\b/g, 'were not')
    .replace(/\bhaven't\b/g, 'have not')
    .replace(/\bhasn't\b/g, 'has not')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\b(he|she|it)'s\b/g, '$1 is')
    .replace(/\b(you|we|they)'re\b/g, '$1 are')
    .replace(/\b(i|you|we|they)'ve\b/g, '$1 have')
    .replace(/\b(i|you|he|she|we|they)'ll\b/g, '$1 will')
    .replace(/\b(i|you|he|she|we|they)'d\b/g, '$1 would')

export function isCorrect(ex: Exercise, answer: Answer): boolean {
  if (answer === null || answer === undefined) return false
  switch (ex.type) {
    case 'mcq':
      return answer === ex.answer
    case 'truefalse':
      return answer === ex.answer
    case 'gap':
      return ex.accepted.some((a) => expand(a) === expand(String(answer)))
    case 'order':
      return expand(String(answer)) === expand(ex.answer)
  }
}

export function correctAnswerText(ex: Exercise): string {
  switch (ex.type) {
    case 'mcq':
      return ex.options[ex.answer]
    case 'truefalse':
      return ex.answer ? 'True' : 'False'
    case 'gap':
      return ex.accepted[0]
    case 'order':
      return ex.answer
  }
}

export const shuffle = <T,>(arr: T[], seed?: number): T[] => {
  const a = [...arr]
  let s = seed ?? Math.floor(Math.random() * 1e9)
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
