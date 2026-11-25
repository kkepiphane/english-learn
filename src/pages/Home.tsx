import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import clsx from 'clsx'
import { db, today } from '../db/db'
import { useProfile } from '../hooks/hooks'
import { Card, Bar, Ring, SpeakButton, StreakChip } from '../components/ui'
import { computeStreak, xpLevel } from '../lib/stats'
import { coachMessage, dailyChallenges, learningLevel, nextLesson, weekStart, weeklyChallenges } from '../lib/recommend'
import { badges, CHEST_XP, earned, weekDots, wordOfTheDay } from '../lib/rewards'
import { addCards, claimChest } from '../lib/repo'
import { celebrate } from '../lib/fx'
import { lessonsFor, getLesson } from '../content'
import { buildBites } from '../lib/lessonDeck'

export default function Home() {
  const profile = useProfile()
  const data = useLiveQuery(async () => ({
    sessions: await db.sessions.toArray(),
    attempts: await db.attempts.toArray(),
    progress: await db.lessonProgress.toArray(),
    cards: await db.cards.toArray(),
    writings: await db.writings.toArray(),
    assessments: await db.assessments.toArray(),
    recordings: await db.recordings.count(),
    placement: await db.kv.get('placement.done'),
    chest: await db.kv.get(`chest.${weekStart()}`),
    bites: await db.kv.where('key').startsWith('lesson.bites.').toArray(),
  }))
  if (!profile || !data) return null

  const level = learningLevel(profile)
  const streak = computeStreak(data.sessions)
  const todayS = data.sessions.find((s) => s.day === today())
  const minutesToday = Math.round((todayS?.seconds ?? 0) / 60)
  const xp = xpLevel(data.sessions.reduce((a, s) => a + s.xp, 0))
  const next = nextLesson(level, data.progress)
  const nextBites = next ? buildBites(next) : []
  const nextDone = Math.min((data.bites.find((b) => b.key === `lesson.bites.${next?.id}`)?.value as number | undefined) ?? 0, Math.max(nextBites.length - 1, 0))
  const levelLessons = lessonsFor(level)
  const doneIds = new Set(data.progress.filter((p) => p.status === 'completed').map((p) => p.lessonId))
  const levelDone = levelLessons.filter((l) => doneIds.has(l.id)).length
  const pending = data.progress.filter((p) => p.status === 'started' && p.lessonId !== next?.id).map((p) => getLesson(p.lessonId)).filter(Boolean)
  const due = data.cards.filter((c) => c.due <= Date.now()).length
  const daily = dailyChallenges(data.sessions, data.attempts, data.cards, profile.dailyGoalMin)
  const weekly = weeklyChallenges(data.sessions, data.writings, data.attempts)
  const lastActive = [...data.sessions].filter((s) => s.seconds >= 60).sort((a, b) => b.day.localeCompare(a.day))[0]?.day
  const dots = weekDots(data.sessions)
  const goalDone = minutesToday >= profile.dailyGoalMin
  const allBadges = badges(data)
  const got = earned(allBadges)

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Hi {profile.name} 👋</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{coachMessage(streak, minutesToday, profile.dailyGoalMin, lastActive)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StreakChip streak={streak} />
          <span className="chip bg-brand-100 font-bold text-brand-800 dark:bg-brand-900/50 dark:text-brand-200" title={`${xp.into} / ${xp.need} XP to level ${xp.lvl + 1}`}>⭐ Lv {xp.lvl}</span>
        </div>
      </header>

      {/* This week */}
      <Card className="py-3.5">
        <ol className="flex justify-between" aria-label="Study days this week">
          {dots.map((d) => (
            <li key={d.day} className="flex flex-col items-center gap-1.5">
              <span className={clsx('text-[11px] font-semibold', d.isToday ? 'text-flame-600' : 'text-ink-400')}>{d.label}</span>
              <span aria-label={`${d.day}${d.done ? ': studied' : ''}`}
                className={clsx('flex h-9 w-9 items-center justify-center rounded-full text-base', {
                  'bg-flame-500 text-white shadow-[0_2px_0_0_theme(colors.flame.700)]': d.done,
                  'border-2 border-dashed border-flame-400': !d.done && d.isToday,
                  'bg-ink-100 dark:bg-ink-800': !d.done && !d.isToday,
                })}>{d.done ? '🔥' : ''}</span>
            </li>
          ))}
        </ol>
      </Card>

      {!data.placement && (
        <Card className="flex items-center gap-4 border-flame-200 bg-flame-50 dark:border-flame-900 dark:bg-flame-900/20">
          <span className="text-4xl" aria-hidden>🧭</span>
          <div className="flex-1">
            <p className="font-display font-bold">Find your real level</p>
            <p className="text-sm text-ink-600 dark:text-ink-300">12 minutes so your path starts at the right place.</p>
          </div>
          <Link to="/placement" className="btn-primary">Take the test</Link>
        </Card>
      )}

      {/* Today's mission */}
      <section aria-labelledby="mission-h" className="relative overflow-hidden rounded-3xl bg-brand-600 p-5 text-white shadow-[0_6px_0_0_theme(colors.brand.800)]">
        <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/60" aria-hidden />
        <span className="pointer-events-none absolute -bottom-14 right-16 h-28 w-28 rounded-full bg-brand-700/60" aria-hidden />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="mission-h" className="text-xs font-bold uppercase tracking-wider text-brand-100">{goalDone ? 'Goal reached · bonus round' : "Today's mission"}</h2>
            {next ? (<>
              <p className="mt-1.5 font-display text-2xl font-extrabold leading-tight">{next.title}</p>
              <p className="mt-1 text-sm text-brand-100">{next.objective}</p>
            </>) : (<>
              <p className="mt-1.5 font-display text-2xl font-extrabold leading-tight">Prove your {level} level</p>
              <p className="mt-1 text-sm text-brand-100">Every {level} lesson is done. Pass the checkpoint to level up.</p>
            </>)}
          </div>
          <Ring value={(minutesToday / profile.dailyGoalMin) * 100} size={68} stroke={7} label={`${minutesToday} of ${profile.dailyGoalMin} minutes today`} tone="onBrand">
            <span className="text-lg font-bold leading-none tabular-nums">{minutesToday}</span>
            <span className="text-[10px] text-brand-100">/{profile.dailyGoalMin} min</span>
          </Ring>
        </div>
        <div className="relative mt-4 flex items-center gap-3">
          <Link to={next ? `/learn/lesson/${next.id}` : `/learn/checkpoint/${level}`}
            className="btn flex-1 bg-white py-3.5 text-base text-brand-700 shadow-[0_4px_0_0_theme(colors.brand.900)] hover:bg-brand-50 active:translate-y-[3px] active:shadow-[0_1px_0_0_theme(colors.brand.900)]">
            {next ? `${nextDone ? 'Continue' : 'Start'} · ${nextBites[nextDone]?.minutes ?? next.minutes} min` : 'Take the checkpoint'} →
          </Link>
        </div>
        {next && nextBites.length > 1 && <p className="relative mt-2 text-center text-xs text-brand-100">Bite {nextDone + 1} of {nextBites.length} · you can stop after each one</p>}
        <div className="relative mt-3 flex items-center gap-2 text-xs text-brand-100">
          <span className="shrink-0 font-semibold">{level} path</span>
          <Bar value={(levelDone / Math.max(levelLessons.length, 1)) * 100} className="h-1.5" track="bg-brand-800/60" color="bg-flame-300" label={`${level} path progress`} />
          <span className="tabular-nums">{levelDone}/{levelLessons.length}</span>
        </div>
      </section>

      {pending.length > 0 && (
        <Card className="py-3">
          <p className="label">Unfinished</p>
          <ul className="mt-1.5 space-y-1">{pending.map((l) => <li key={l!.id}><Link className="text-sm font-semibold text-brand-600 dark:text-brand-300" to={`/learn/lesson/${l!.id}`}>Finish: {l!.title} →</Link></li>)}</ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <WordOfTheDay level={level} />
        <Link to="/practice/flashcards" className="card flex flex-col justify-between p-4 transition hover:border-brand-300">
          <span className="label">Review</span>
          <span className="mt-2 font-display text-3xl font-extrabold tabular-nums">{due}</span>
          <span className="text-sm text-ink-500">{due === 1 ? 'card due' : 'cards due'}{due ? ' · go!' : ''}</span>
        </Link>
      </div>

      {/* Daily challenges */}
      <Card>
        <h2 className="label">Daily challenges</h2>
        <ul className="mt-3 space-y-3">{daily.map((x) => {
          const ok = x.done >= x.target
          return (
            <li key={x.id} className="flex items-center gap-3 text-sm">
              <span className={clsx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', ok ? 'bg-emerald-500 text-white' : 'bg-ink-100 text-ink-400 dark:bg-ink-800')} aria-hidden>{ok ? '✓' : ''}</span>
              <span className="min-w-0 flex-1">
                <span className={clsx('flex justify-between gap-2', ok && 'text-ink-400 line-through')}><span>{x.label}</span><span className="tabular-nums text-ink-400">{Math.min(x.done, x.target)}/{x.target}</span></span>
                <Bar value={(x.done / x.target) * 100} className="mt-1 h-1.5" color={ok ? 'bg-emerald-500' : 'bg-brand-500'} label={x.label} />
              </span>
            </li>
          )
        })}</ul>
      </Card>

      <WeeklyChest challenges={weekly} opened={!!data.chest} />

      {/* Badges */}
      <Link to="/progress" className="card flex items-center gap-3 p-4 transition hover:border-brand-300">
        <span className="flex -space-x-1.5 text-2xl" aria-hidden>
          {(got.length ? got.slice(-4) : allBadges.slice(0, 3)).map((b) => <span key={b.id} className={clsx('flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-flame-50 dark:border-ink-900 dark:bg-ink-800', !got.length && 'opacity-40 grayscale')}>{b.icon}</span>)}
        </span>
        <span className="flex-1">
          <span className="block font-display font-bold">Badges</span>
          <span className="text-sm text-ink-500">{got.length}/{allBadges.length} collected</span>
        </span>
        <span className="text-ink-300" aria-hidden>›</span>
      </Link>
    </div>
  )
}

function WordOfTheDay({ level }: { level: Parameters<typeof lessonsFor>[0] }) {
  const w = wordOfTheDay(lessonsFor(level))
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  if (!w) return null
  return (
    <div className="card flex flex-col p-4">
      <span className="label">Word of the day</span>
      <span className="mt-2 flex items-center gap-1.5">
        <span className="font-display text-xl font-extrabold">{w.word}</span>
        <SpeakButton text={w.word} className="h-7 w-7" />
      </span>
      {open ? (
        <span className="mt-1 animate-rise text-sm">
          <span className="block text-ink-600 dark:text-ink-300">{w.definition}</span>
          <span className="block text-ink-400">{w.fr}</span>
          <button className="mt-1.5 text-xs font-semibold text-brand-600 dark:text-brand-300" disabled={saved}
            onClick={() => void addCards([{ id: `${level}:${w.id}`, front: w.word, back: `${w.definition} — ${w.fr}`, ipa: w.ipa, example: w.example, source: `${level}:wotd` }]).then(() => setSaved(true))}>
            {saved ? '✓ In your flashcards' : '+ Save to flashcards'}
          </button>
        </span>
      ) : (
        <button className="mt-1 text-left text-sm font-semibold text-brand-600 dark:text-brand-300" onClick={() => setOpen(true)}>Guess it, then reveal →</button>
      )}
    </div>
  )
}

function WeeklyChest({ challenges, opened }: { challenges: ReturnType<typeof weeklyChallenges>; opened: boolean }) {
  const done = challenges.filter((c) => c.done >= c.target).length
  const ready = done === challenges.length && !opened
  const open = async () => {
    if (await claimChest(weekStart(), CHEST_XP)) celebrate()
  }
  return (
    <Card className={clsx(ready && 'border-flame-300 dark:border-flame-800')}>
      <div className="flex items-center gap-4">
        <span className={clsx('text-5xl', ready && 'animate-wiggle')} aria-hidden>{opened ? '🎉' : '🎁'}</span>
        <div className="flex-1">
          <h2 className="font-display font-bold">Weekly chest</h2>
          <p className="text-sm text-ink-500">{opened ? `Opened! +${CHEST_XP} XP. A new chest arrives Monday.` : ready ? 'All weekly challenges done. Open it!' : `Finish the ${challenges.length} weekly challenges to win ${CHEST_XP} XP.`}</p>
        </div>
        {ready && <button className="btn-primary bg-flame-500 shadow-[0_3px_0_0_theme(colors.flame.700)] hover:bg-flame-400" onClick={() => void open()}>Open</button>}
      </div>
      {!opened && (
        <ul className="mt-3 space-y-2">{challenges.map((x) => (
          <li key={x.id} className="text-sm">
            <div className="flex justify-between"><span className={clsx(x.done >= x.target && 'text-ink-400 line-through')}>{x.label}</span><span className="tabular-nums text-ink-400">{Math.min(x.done, x.target)}/{x.target}</span></div>
            <Bar value={(x.done / x.target) * 100} className="mt-1 h-1.5" color={x.done >= x.target ? 'bg-emerald-500' : 'bg-flame-400'} label={x.label} />
          </li>
        ))}</ul>
      )}
    </Card>
  )
}
