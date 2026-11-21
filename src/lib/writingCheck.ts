/**
 * Offline writing feedback (no AI). Deterministic rules aimed at the most frequent errors of
 * French-speaking learners, each with an explanation — the goal is to teach, not just rewrite.
 * When online + logged in, the AI feedback from the API is shown in addition to this.
 */
export type IssueType = 'grammar' | 'spelling' | 'vocabulary' | 'style' | 'structure'

export interface Issue {
  type: IssueType
  excerpt: string
  suggestion: string
  why: string
  whyFr: string
}

export interface WritingFeedback {
  wordCount: number
  sentenceCount: number
  paragraphCount: number
  connectors: string[]
  lexicalVariety: number // 0–100
  issues: Issue[]
  improved: string
  criteria: { name: string; score: number; comment: string }[] // 0–5
  tips: string[]
}

interface Rule {
  type: IssueType
  re: RegExp
  fix: (m: RegExpExecArray) => string
  why: string
  whyFr: string
  auto?: boolean // safe to apply in the improved version
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const RULES: Rule[] = [
  { type: 'grammar', re: /\bI am agree\b/gi, fix: () => 'I agree', why: '"Agree" is a verb, not an adjective: no "am".', whyFr: '« Agree » est un verbe : on ne dit pas « I am agree » (calque de « je suis d\'accord »).', auto: true },
  { type: 'grammar', re: /\bI have (\d{1,2}) years\b/gi, fix: (m) => `I am ${m[1]} years old`, why: 'Age uses "be" in English: I am 25 (years old).', whyFr: 'L\'âge s\'exprime avec « be » : I am 25.', auto: true },
  { type: 'grammar', re: /\b(he|she|it) (don't)\b/gi, fix: (m) => `${m[1]} doesn't`, why: 'Third person singular takes "doesn\'t".', whyFr: 'À la 3e personne du singulier : doesn\'t.', auto: true },
  { type: 'grammar', re: /\b(he|she|it) have\b/gi, fix: (m) => `${m[1]} has`, why: 'Third person singular of "have" is "has".', whyFr: '3e personne du singulier : has.', auto: true },
  { type: 'grammar', re: /\bpeople is\b/gi, fix: () => 'people are', why: '"People" is plural.', whyFr: '« People » est pluriel : people are.', auto: true },
  { type: 'grammar', re: /\bmore (better|worse|bigger|smaller|easier|harder)\b/gi, fix: (m) => m[1], why: 'Do not combine "more" with a comparative ending in -er.', whyFr: 'Pas de « more » avec un comparatif en -er.', auto: true },
  { type: 'grammar', re: /\bdepends? of\b/gi, fix: (m) => m[0].replace(/of$/i, 'on'), why: 'The preposition after "depend" is "on".', whyFr: 'On dit « depend on », pas « depend of ».', auto: true },
  { type: 'grammar', re: /\bexplain me\b/gi, fix: () => 'explain to me', why: '"Explain" needs "to" before the person.', whyFr: '« Explain » demande « to » devant la personne.', auto: true },
  { type: 'grammar', re: /\bdiscuss about\b/gi, fix: () => 'discuss', why: '"Discuss" is transitive: no "about".', whyFr: '« Discuss » est transitif : pas de « about ».', auto: true },
  { type: 'grammar', re: /\bsince (\d+|two|three|four|five|six|ten|many|several) (years|months|weeks|days|hours)\b/gi, fix: (m) => `for ${m[1]} ${m[2]}`, why: 'Use "for" with a duration and "since" with a starting point (since 2020).', whyFr: '« for » + durée, « since » + point de départ (since 2020).', auto: true },
  { type: 'grammar', re: /\bin the same time\b/gi, fix: () => 'at the same time', why: 'The fixed expression is "at the same time".', whyFr: 'L\'expression figée est « at the same time ».', auto: true },
  { type: 'grammar', re: /\b(it|this) permits? to\b/gi, fix: (m) => `${m[1]} allows us to`, why: '"Permit/allow" need an object: it allows us/people to…', whyFr: '« allow » demande un complément : it allows us to…', auto: true },
  { type: 'grammar', re: /\bthe (life|society|nature|education|technology) (is|has|can)\b/gi, fix: (m) => `${m[1]} ${m[2]}`, why: 'No article for general/abstract nouns in English.', whyFr: 'Pas d\'article devant un nom pris au sens général.', auto: true },
  { type: 'grammar', re: /\b(informations|advices|furnitures|equipments|homeworks|knowledges|evidences|feedbacks)\b/gi, fix: (m) => m[1].replace(/s$/i, ''), why: 'This noun is uncountable in English: no plural -s.', whyFr: 'Ce nom est indénombrable en anglais : pas de -s.', auto: true },
  { type: 'grammar', re: /\bmake (a|my) (homework|sport)\b/gi, fix: (m) => (m[2].toLowerCase() === 'sport' ? 'do sport' : 'do my homework'), why: 'We "do" homework and sport.', whyFr: 'On utilise « do » avec homework et sport.', auto: true },
  { type: 'vocabulary', re: /\bactually\b/gi, fix: () => 'currently / at the moment', why: '"Actually" means "in fact", not "actuellement". Check your meaning.', whyFr: 'Faux ami : « actually » = en fait. « Actuellement » = currently.' },
  { type: 'vocabulary', re: /\beventually\b/gi, fix: () => 'possibly', why: '"Eventually" means "in the end", not "éventuellement".', whyFr: 'Faux ami : « eventually » = finalement. « Éventuellement » = possibly.' },
  { type: 'vocabulary', re: /\bassist(ed)? to\b/gi, fix: (m) => (m[1] ? 'attended' : 'attend'), why: '"Assist" means help. To be present at = "attend".', whyFr: 'Faux ami : assister à = attend.', auto: true },
  { type: 'vocabulary', re: /\b(a|the) formation\b/gi, fix: (m) => `${m[1]} training course`, why: '"Formation" ≠ training. Use "training (course)".', whyFr: 'Faux ami : une formation = a training course.', auto: true },
  { type: 'spelling', re: /(^|[.!?]\s+)i\b/g, fix: (m) => `${m[1]}I`, why: 'The pronoun "I" is always a capital letter.', whyFr: 'Le pronom « I » prend toujours une majuscule.', auto: true },
  { type: 'spelling', re: /(\s)i(\s|')/g, fix: (m) => `${m[1]}I${m[2]}`, why: 'The pronoun "I" is always a capital letter.', whyFr: 'Le pronom « I » prend toujours une majuscule.', auto: true },
  { type: 'spelling', re: /\b(\w+) \1\b/gi, fix: (m) => m[1], why: 'Repeated word.', whyFr: 'Mot répété.', auto: true },
  { type: 'spelling', re: / ([,.!?;:])/g, fix: (m) => m[1], why: 'No space before punctuation in English.', whyFr: 'Pas d\'espace avant la ponctuation en anglais (contrairement au français).', auto: true },
  { type: 'spelling', re: /\b(recieve|beleive|wich|becouse|untill|tommorow|adress|developement|enviroment|occured|seperate|definately|responsability|exemple|mariage)\b/gi, fix: (m) => ({ recieve: 'receive', beleive: 'believe', wich: 'which', becouse: 'because', untill: 'until', tommorow: 'tomorrow', adress: 'address', developement: 'development', enviroment: 'environment', occured: 'occurred', seperate: 'separate', definately: 'definitely', responsability: 'responsibility', exemple: 'example', mariage: 'marriage' } as Record<string, string>)[m[1].toLowerCase()], why: 'Spelling mistake (often influenced by French).', whyFr: 'Faute d\'orthographe (souvent influencée par le français).', auto: true },
]

export const CONNECTORS = ['first', 'firstly', 'secondly', 'then', 'next', 'finally', 'however', 'moreover', 'furthermore', 'in addition', 'also', 'because', 'so', 'therefore', 'as a result', 'for example', 'for instance', 'on the other hand', 'although', 'while', 'whereas', 'in conclusion', 'to sum up', 'overall', 'but', 'and', 'nevertheless', 'despite', 'in my opinion', 'i believe', 'personally']
const WEAK = ['very', 'good', 'bad', 'thing', 'things', 'nice', 'big', 'a lot of', 'stuff']

export function analyseWriting(text: string, opts: { minWords?: number; maxWords?: number; formal?: boolean } = {}): WritingFeedback {
  const clean = text.trim()
  const words = clean.match(/[A-Za-z']+/g) ?? []
  const wordCount = words.length
  const sentences = clean.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0)
  const paragraphs = clean.split(/\n\s*\n/).filter((p) => p.trim())
  const lower = ` ${clean.toLowerCase()} `
  const connectors = CONNECTORS.filter((c) => new RegExp(`\\b${c}\\b`).test(lower))
  const content = words.map((w) => w.toLowerCase()).filter((w) => w.length > 3)
  const lexicalVariety = content.length ? Math.round((new Set(content).size / content.length) * 100) : 0

  const issues: Issue[] = []
  let improved = clean
  for (const r of RULES) {
    r.re.lastIndex = 0
    let m: RegExpExecArray | null
    const seen = new Set<string>()
    while ((m = r.re.exec(clean))) {
      const key = m[0].toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        issues.push({ type: r.type, excerpt: m[0].trim(), suggestion: r.fix(m).trim(), why: r.why, whyFr: r.whyFr })
      }
      if (m[0].length === 0) r.re.lastIndex++
    }
    if (r.auto) improved = improved.replace(r.re, (...args) => r.fix(args as unknown as RegExpExecArray))
  }
  // Sentence-initial capitals
  sentences.forEach((s) => {
    const t = s.trim()
    if (/^[a-z]/.test(t)) issues.push({ type: 'spelling', excerpt: t.slice(0, 25) + (t.length > 25 ? '…' : ''), suggestion: cap(t.slice(0, 25)), why: 'Start every sentence with a capital letter.', whyFr: 'Chaque phrase commence par une majuscule.' })
  })
  improved = improved.replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase())
  if (clean && !/[.!?]$/.test(clean)) {
    issues.push({ type: 'spelling', excerpt: clean.slice(-20), suggestion: 'Add a full stop.', why: 'End your text with punctuation.', whyFr: 'Terminez le texte par un point.' })
    improved += '.'
  }
  sentences.forEach((s) => {
    const n = (s.match(/[A-Za-z']+/g) ?? []).length
    if (n > 35) issues.push({ type: 'structure', excerpt: s.slice(0, 40) + '…', suggestion: 'Split into two sentences.', why: `This sentence has ${n} words. Long sentences hide mistakes and lose the reader.`, whyFr: `Cette phrase fait ${n} mots : coupez-la en deux.` })
  })
  for (const w of WEAK) {
    const count = (lower.match(new RegExp(`\\b${w}\\b`, 'g')) ?? []).length
    if (count >= 3) issues.push({ type: 'vocabulary', excerpt: `"${w}" ×${count}`, suggestion: w === 'very' ? 'extremely, really, highly — or a stronger adjective (very good → excellent)' : w === 'good' ? 'useful, effective, valuable, enjoyable' : w === 'a lot of' ? 'many, much, plenty of, a large number of' : 'a more precise word', why: 'Repeating basic words lowers your vocabulary score.', whyFr: 'Répéter des mots simples fait baisser la note de vocabulaire.' })
  }
  if (opts.formal && /\b\w+n't\b|\b(I'm|it's|you're|we're|they're)\b/i.test(clean))
    issues.push({ type: 'style', excerpt: 'contractions', suggestion: 'do not, I am, it is…', why: 'In formal/academic writing, avoid contractions.', whyFr: 'En écrit formel ou académique, évitez les contractions.' })

  // Several rules can catch the same mistake (e.g. lowercase "i"): keep one entry per excerpt + fix.
  const seenIssue = new Set<string>()
  for (let k = issues.length - 1; k >= 0; k--) {
    const key = `${issues[k].excerpt.toLowerCase()}|${issues[k].suggestion.toLowerCase()}`
    if (seenIssue.has(key)) issues.splice(k, 1)
    else seenIssue.add(key)
  }

  const tips: string[] = []
  const { minWords = 0, maxWords = Infinity } = opts
  if (wordCount < minWords) tips.push(`Too short: ${wordCount} words, at least ${minWords} expected. Develop your ideas with an example or a reason.`)
  if (wordCount > maxWords) tips.push(`Too long: ${wordCount} words, maximum ${maxWords}. Remove repetitions.`)
  if (connectors.length < 3 && wordCount > 40) tips.push('Use more linking words (first, however, for example, as a result) to make your text coherent.')
  if (paragraphs.length < 2 && wordCount > 120) tips.push('Organise your text in paragraphs: introduction, ideas, conclusion.')
  if (lexicalVariety < 55 && wordCount > 50) tips.push('Vary your vocabulary: avoid repeating the same words.')

  const errorCount = issues.filter((i) => i.type === 'grammar' || i.type === 'spelling').length
  const per100 = wordCount ? (errorCount / wordCount) * 100 : 0
  const clamp = (n: number) => Math.max(0, Math.min(5, Math.round(n * 2) / 2))
  const criteria = [
    { name: 'Task achievement', score: clamp(wordCount >= minWords ? (wordCount <= maxWords ? 4.5 : 3.5) : 1 + (4 * wordCount) / Math.max(minWords, 1) * 0.6), comment: wordCount >= minWords ? 'Length is appropriate.' : 'Text is too short to fully answer the task.' },
    { name: 'Coherence', score: clamp(1.5 + Math.min(connectors.length, 6) * 0.5 + (paragraphs.length > 1 ? 0.5 : 0)), comment: `${connectors.length} linking word(s) used.` },
    { name: 'Vocabulary', score: clamp(lexicalVariety / 20 - issues.filter((i) => i.type === 'vocabulary').length * 0.5), comment: `Lexical variety ${lexicalVariety}%.` },
    { name: 'Grammar & spelling', score: clamp(5 - per100 * 0.8), comment: `${errorCount} detected error(s). Rule-based check: some errors can't be detected offline.` },
  ]
  return { wordCount, sentenceCount: sentences.length, paragraphCount: paragraphs.length, connectors, lexicalVariety, issues, improved, criteria, tips }
}
