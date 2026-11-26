import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, CaretRight, Clock, Lightning, MapPin, Question, Repeat, Stack, Timer, TextAa, UserCircle, Warning, type Icon } from '@phosphor-icons/react'
import { db } from '../db/db'
import { BASICS, getSheet } from '../content'
import { Card, Fr, Notice, PageTitle, SpeakButton } from '../components/ui'
import { useProfile } from '../hooks/hooks'
import { MIX_ID, SPRINT_SECONDS, sprintKey, type SprintRecord } from '../lib/sprint'

const SHEET_ICON: Record<string, Icon> = {
  'a1-be': UserCircle, 'a1-present': Repeat, 'a1-articles': TextAa, 'a1-plurals': Stack,
  'a1-questions': Question, 'a1-time': Clock, 'a1-can': Lightning, 'a1-there': MapPin,
}

function useRecords() {
  return useLiveQuery(async () => {
    const rows = await db.kv.where('key').startsWith('sprint.').toArray()
    return new Map(rows.map((r) => [r.key, r.value as SprintRecord]))
  }, [], new Map<string, SprintRecord>())
}

/** A1 tab of the Learn page: quick review sheets and timed sprints. */
export function BasicsHome() {
  const records = useRecords()
  const mix = records.get(sprintKey(MIX_ID))
  return (
    <div className="space-y-4">
      <Link to={`/basics/sprint/${MIX_ID}`} className="relative block overflow-hidden rounded-[1.5rem] bg-flame-500 p-5 text-white shadow-[0_6px_0_0_theme(colors.flame.700)] transition active:translate-y-[3px] active:shadow-[0_3px_0_0_theme(colors.flame.700)]">
        <span className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 animate-float rounded-full bg-flame-400/70" aria-hidden />
        <span className="relative flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20" aria-hidden><Timer size={32} weight="fill" /></span>
          <span className="flex-1">
            <span className="block font-display text-xl font-extrabold">Mixed sprint · {SPRINT_SECONDS.mix} s</span>
            <span className="text-sm text-flame-50">{mix ? `Beat your ghost: ${mix.best}` : 'All A1 basics, against the clock'}</span>
          </span>
          <ArrowRight size={24} weight="bold" aria-hidden />
        </span>
      </Link>

      <ul className="grid grid-cols-2 gap-3">
        {BASICS.map((b) => {
          const I = SHEET_ICON[b.id] ?? TextAa
          const rec = records.get(sprintKey(b.id))
          return (
            <li key={b.id}>
              <Link to={`/basics/${b.id}`} className="card flex h-full flex-col gap-2 p-4 shadow-[0_4px_0_0_theme(colors.ink.200)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_theme(colors.ink.200)] dark:shadow-[0_4px_0_0_theme(colors.ink.950)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200" aria-hidden><I size={22} weight="fill" /></span>
                <span className="font-display font-bold leading-tight">{b.title}</span>
                <span className="mt-auto text-xs font-semibold text-ink-400">{rec ? `Best: ${rec.best}` : 'Not tried yet'}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function SheetPage() {
  const sheet = getSheet(useParams().id!)
  const fr = useProfile()?.uiFrench ?? true
  const rec = useRecords().get(sprintKey(sheet?.id ?? ''))
  if (!sheet) return <Notice tone="error">Sheet not found.</Notice>
  const I = SHEET_ICON[sheet.id] ?? TextAa
  return (
    <div className="space-y-4">
      <PageTitle back="/learn?level=A1" title={sheet.title} />
      <Card className="space-y-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200" aria-hidden><I size={24} weight="fill" /></span>
        <ul className="space-y-3">
          {sheet.points.map((p) => (
            <li key={p.rule}>
              <p className="font-bold">{p.rule}</p>
              <p className="mt-1 flex items-center gap-2 text-ink-600 dark:text-ink-300"><SpeakButton text={p.example} className="h-7 w-7" /><span className="italic">{p.example}</span></p>
            </li>
          ))}
        </ul>
        <Fr show={fr}>{sheet.fr}</Fr>
      </Card>
      <Card className="flex items-start gap-3 border-flame-200 bg-flame-50 dark:border-flame-900 dark:bg-flame-900/20">
        <Warning size={22} weight="fill" className="mt-0.5 shrink-0 text-flame-500" aria-hidden />
        <p className="text-sm"><span className="text-flame-700 line-through dark:text-flame-300">{sheet.trap.wrong}</span><span className="mx-1.5 text-ink-400">→</span><span className="font-bold">{sheet.trap.right}</span></p>
      </Card>
      <Link to={`/basics/sprint/${sheet.id}`} className="btn-cta w-full py-3.5 text-base">
        <Timer size={20} weight="fill" aria-hidden /> Sprint · {SPRINT_SECONDS.sheet} s{rec ? ` · best ${rec.best}` : ''}
      </Link>
      <Link to="/learn?level=A1" className="flex items-center justify-center gap-1 text-sm font-semibold text-ink-500">All A1 sheets <CaretRight aria-hidden /></Link>
    </div>
  )
}
