import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import clsx from 'clsx'
import { db, today } from '../db/db'
import { useProfile } from '../hooks/hooks'
import { Card, Bar, Ring, SpeakButton, StreakChip, CountUp } from '../components/ui'
import { computeStreak, xpLevel } from '../lib/stats'
import { coachMessage, dailyChallenges, learningLevel, nextLesson, weekStart, weeklyChallenges } from '../lib/recommend'
import { badges, bestStreak, CHEST_XP, earned, nextStreakMilestone, weekDots, wordOfTheDay } from '../lib/rewards'
import { loadRewardData } from '../lib/rewardData'
import { dueReviews, loadReviewStates, nextReview, REVIEW_LABELS, REVIEW_XP } from '../lib/review'
import { addCards, claimChest } from '../lib/repo'
import { celebrate } from '../lib/fx'
import { lessonsFor, getLesson, availableLevels } from '../content'
import { buildBites } from '../lib/lessonDeck'
import { DREAMS, EXAM_RANGE, daysLeft, dreamTitle, records, weekVsWeek, whyOf } from '../lib/goals'
import { LEVELS, type Level } from '../content/types'
import { ArrowRight, ArrowsClockwise, CaretRight, Cards, Check, Compass, Fire, Flag, Lightning, Plus, Trophy } from '@phosphor-icons/react'
import { DREAM_ICON } from '../components/dreamIcons'
import type { Profile, StudySession, LessonProgress } from '../db/db'

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
    reviewStates: await loadReviewStates(),
    rewards: await loadRewardData(),
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
  const nextMilestone = nextStreakMilestone(streak)
  const dueRev = dueReviews(data.progress, data.reviewStates)
  const upcoming = dueRev.length ? undefined : nextReview(data.progress, data.reviewStates)
  const goalDone = minutesToday >= profile.dailyGoalMin
  const allBadges = badges(data.rewards)
  const got = earned(allBadges)

  return (
    <div className="stagger space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Hi {profile.name} 👋</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{coachMessage(streak, minutesToday, profile.dailyGoalMin, lastActive)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StreakChip streak={streak} />
          <span className="chip bg-brand-50 font-bold text-brand-800 dark:bg-brand-900/50 dark:text-brand-200" title={`${xp.into} / ${xp.need} XP to level ${xp.lvl + 1}`}><Lightning weight="fill" className="text-brand-500" aria-hidden /> Lv {xp.lvl}</span>
        </div>
      </header>

      <DreamCard profile={profile} progress={data.progress} />

      {/* This week */}
      <Card className="py-3.5">
        <ol className="flex justify-between" aria-label="Study days this week">
          {dots.map((d) => (
            <li key={d.day} className="flex flex-col items-center gap-1.5">
              <span className={clsx('text-[11px] font-semibold', d.isToday ? 'text-flame-600' : 'text-ink-400')}>{d.label}</span>
              <span aria-label={`${d.day}${d.done ? ': studied' : ''}`}
                className={clsx('flex h-9 w-9 items-center justify-center rounded-full text-base', {
                  'bg-flame-500 text-white shadow-[0_3px_0_0_theme(colors.flame.700)]': d.done,
                  'border-2 border-dashed border-flame-400': !d.done && d.isToday,
                  'bg-ink-100 dark:bg-ink-800': !d.done && !d.isToday,
                })}>{d.done && <Fire weight="fill" aria-hidden />}</span>
            </li>
          ))}
        </ol>
        {nextMilestone && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-500">
            <Fire weight="fill" className="text-flame-500" aria-hidden />
            {nextMilestone - streak === 1 ? 'Tomorrow' : `${nextMilestone - streak} more days`}: {nextMilestone}-day streak badge
          </p>
        )}
      </Card>

      {!data.placement && (
        <Card className="flex items-center gap-4 border-flame-200 bg-flame-50 dark:border-flame-900 dark:bg-flame-900/20">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-flame-500 dark:bg-ink-900" aria-hidden><Compass size={28} weight="fill" /></span>
          <div className="flex-1">
            <p className="font-display font-bold">Find your real level</p>
            <p className="text-sm text-ink-500">12 minutes</p>
          </div>
          <Link to="/placement" className="btn-primary">Take the test</Link>
        </Card>
      )}

      {/* Today's mission */}
      <section aria-labelledby="mission-h" className="relative overflow-hidden rounded-[1.5rem] bg-brand-700 p-5 text-white shadow-[0_6px_0_0_theme(colors.brand.900)]">
        <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 animate-float rounded-full bg-brand-600/70" aria-hidden />
        <span className="pointer-events-none absolute -bottom-14 right-16 h-28 w-28 animate-float rounded-full bg-brand-800/60 [animation-delay:-3s]" aria-hidden />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="mission-h" className="text-[11px] font-bold uppercase tracking-[.08em] text-brand-200">{goalDone ? 'Goal reached · bonus round' : "Today's mission"}</h2>
            {next ? (<>
              <p className="mt-1.5 font-display text-2xl font-extrabold leading-tight">{next.title}</p>
            </>) : (<>
              <p className="mt-1.5 font-display text-2xl font-extrabold leading-tight">Prove your {level} level</p>
            </>)}
          </div>
          <Ring value={(minutesToday / profile.dailyGoalMin) * 100} size={68} stroke={7} label={`${minutesToday} of ${profile.dailyGoalMin} minutes today`} tone="onBrand">
            <span className="text-lg font-bold leading-none tabular-nums">{minutesToday}</span>
            <span className="text-[10px] text-brand-100">/{profile.dailyGoalMin} min</span>
          </Ring>
        </div>
        <div className="relative mt-4 flex items-center gap-3">
          <Link to={next ? `/learn/lesson/${next.id}` : `/learn/checkpoint/${level}`}
            className="btn-cta shine relative flex-1 overflow-hidden py-3.5 text-base shadow-[0_3px_0_0_theme(colors.flame.800)]">
            {next ? `${nextDone ? 'Continue' : 'Start'} · ${nextBites[nextDone]?.minutes ?? next.minutes} min` : 'Take the checkpoint'} <ArrowRight weight="bold" aria-hidden />
          </Link>
        </div>
        {next && nextBites.length > 1 && <p className="relative mt-2 text-center text-xs text-brand-100">Bite {nextDone + 1}/{nextBites.length}</p>}
        <div className="relative mt-3 flex items-center gap-2 text-xs text-brand-100">
          <span className="shrink-0 font-semibold">{level} path</span>
          <Bar value={(levelDone / Math.max(levelLessons.length, 1)) * 100} className="h-1.5" track="bg-brand-900/50" color="bg-sun-400" label={`${level} path progress`} />
          <span className="tabular-nums">{levelDone}/{levelLessons.length}</span>
        </div>
      </section>

      {pending.length > 0 && (
        <Card className="py-3">
          <p className="label">Unfinished</p>
          <ul className="mt-1.5 space-y-1">{pending.map((l) => <li key={l!.id}><Link className="text-sm font-semibold text-brand-600 dark:text-brand-300" to={`/learn/lesson/${l!.id}`}>Finish: {l!.title} <ArrowRight className="inline" aria-hidden /></Link></li>)}</ul>
        </Card>
      )}

      {dueRev.length > 0 ? (
        <Card className="border-brand-200 dark:border-brand-800">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold"><ArrowsClockwise className="text-brand-600 dark:text-brand-300" aria-hidden />Time to review</h2>
          <ul className="mt-3 space-y-2">
            {dueRev.slice(0, 3).map((r) => (
              <li key={r.lesson.id}>
                <Link to={`/learn/review/${r.lesson.id}`} className="flex items-center gap-3 rounded-2xl border-2 border-b-4 border-ink-200 p-3 transition active:translate-y-[2px] active:border-b-2 dark:border-ink-700">
                  <span className="min-w-0 flex-1"><span className="block truncate font-bold">{r.lesson.title}</span><span className="text-xs text-ink-500">{REVIEW_LABELS[r.stage]} · +{REVIEW_XP} XP</span></span>
                  <ArrowRight weight="bold" className="text-brand-600" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          {dueRev.length > 3 && <p className="mt-2 text-xs text-ink-400">+{dueRev.length - 3} more waiting</p>}
        </Card>
      ) : upcoming && (
        <p className="flex items-center gap-2 px-1 text-sm text-ink-500"><ArrowsClockwise className="text-brand-500" aria-hidden />Next review: <span className="font-semibold text-ink-700 dark:text-ink-200">{upcoming.lesson.title}</span> in {Math.max(1, Math.ceil((upcoming.due - Date.now()) / 86_400_000))} days</p>
      )}

      <YouVsYou sessions={data.sessions} />

      <div className="grid grid-cols-2 gap-3">
        <WordOfTheDay level={level} />
        <Link to="/practice/flashcards" className="card flex flex-col justify-between p-4 transition hover:border-brand-300">
          <span className="label flex items-center gap-1.5"><Cards size={16} weight="bold" className="text-brand-600" aria-hidden />Review</span>
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
              <span className={clsx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', ok ? 'bg-emerald-500 text-white' : 'bg-ink-100 text-ink-400 dark:bg-ink-800')} aria-hidden>{ok && <Check weight="bold" />}</span>
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
          {(got.length ? got.slice(-4) : allBadges.slice(0, 3)).map((b) => <span key={b.id} className={clsx('flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-sun-100 dark:border-ink-900 dark:bg-ink-800', !got.length && 'opacity-40 grayscale')}>{b.icon}</span>)}
        </span>
        <span className="flex-1">
          <span className="block font-display font-bold">Badges</span>
          <span className="text-sm text-ink-500">{got.length}/{allBadges.length} collected</span>
        </span>
        <CaretRight className="text-ink-300" weight="bold" aria-hidden />
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
            {saved ? <><Check className="inline" weight="bold" aria-hidden /> In your flashcards</> : <><Plus className="inline" weight="bold" aria-hidden /> Save to flashcards</>}
          </button>
        </span>
      ) : (
        <button className="mt-1 text-left text-sm font-semibold text-brand-600 dark:text-brand-300" onClick={() => setOpen(true)}>Reveal <ArrowRight className="inline" aria-hidden /></button>
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
          <p className="text-sm text-ink-500">{opened ? `+${CHEST_XP} XP · new chest on Monday` : ready ? 'Ready to open!' : `${done}/${challenges.length} challenges · +${CHEST_XP} XP`}</p>
        </div>
        {ready && <button className="btn-cta" onClick={() => void open()}>Open</button>}
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

/** The learner's dream, always on top: destination, countdown, level ladder and exam equivalence. */
function DreamCard({ profile, progress }: { profile: Profile; progress: LessonProgress[] }) {
  const why = whyOf(profile)
  if (!why)
    return (
      <Link to="/goal" className="card flex items-center gap-4 border-2 border-dashed border-brand-300 p-4 transition hover:border-brand-500 dark:border-brand-800">
        <span className="grid shrink-0 grid-cols-2 gap-1 text-brand-600 dark:text-brand-300" aria-hidden>{Object.values(DREAM_ICON).map((I, k) => <I key={k} size={22} weight="fill" />)}</span>
        <span className="flex-1">
          <span className="block font-display font-extrabold">What is your English for?</span>
          <span className="text-sm text-ink-500">Set your goal</span>
        </span>
        <CaretRight className="text-ink-300" weight="bold" aria-hidden />
      </Link>
    )
  const days = daysLeft(why.date)
  const demonstrated = profile.currentLevel && profile.currentLevel !== 'pre-A2' ? LEVELS.indexOf(profile.currentLevel) : -1
  const goalIdx = LEVELS.indexOf(profile.goalLevel)
  // Lessons still to do on the levels between now and the goal (only levels whose content exists).
  const done = new Set(progress.filter((p) => p.status === 'completed').map((p) => p.lessonId))
  const left = availableLevels().filter((l) => LEVELS.indexOf(l) > demonstrated && LEVELS.indexOf(l) <= goalIdx).flatMap((l) => lessonsFor(l)).filter((l) => !done.has(l.id)).length
  const dayIdx = Math.floor(Date.now() / 86_400_000)
  const push = DREAMS[why.dreams[dayIdx % why.dreams.length]].push
  const range = EXAM_RANGE[profile.goalLevel]
  return (
    <Link to="/goal" className="card relative block overflow-hidden p-4 transition hover:border-brand-300">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 animate-float items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200" aria-hidden>{(() => { const I = DREAM_ICON[why.dreams[0]]; return <I size={28} weight="fill" /> })()}</span>
        <div className="min-w-0 flex-1">
          <p className="label">My goal</p>
          <p className="font-display text-xl font-extrabold leading-tight">{dreamTitle(why)}</p>
          <p className="mt-0.5 text-xs text-ink-500">{profile.goalLevel}{profile.exam !== 'none' ? ` · ${profile.exam === 'ielts' ? `IELTS ${range.ielts}` : `TOEFL iBT ${range.toefl}`}` : ''}</p>
        </div>
        {days !== null && (
          <span className="shrink-0 rounded-2xl bg-flame-50 px-3 py-1.5 text-center text-flame-700 dark:bg-flame-900/40 dark:text-flame-100">
            <span className="block font-display text-xl font-extrabold leading-none tabular-nums"><CountUp to={days} /></span>
            <span className="text-[10px] font-bold uppercase">days left</span>
          </span>
        )}
      </div>
      <ol className="mt-4 flex items-center gap-1" aria-label={`Level ladder: demonstrated ${profile.currentLevel ?? 'unknown'}, goal ${profile.goalLevel}`}>
        {LEVELS.map((l: Level, i) => (
          <li key={l} className="flex flex-1 flex-col items-center gap-1">
            <span className={clsx('h-2.5 w-full rounded-full', i <= demonstrated ? 'bg-brand-500' : i <= goalIdx ? 'bg-brand-100 dark:bg-brand-900' : 'bg-ink-100 dark:bg-ink-800')} />
            <span className={clsx('text-xs font-bold', i === goalIdx ? 'text-brand-700 dark:text-brand-300' : i <= demonstrated ? 'text-brand-600' : 'text-ink-400')}>{l}{i === goalIdx ? <Flag className="ml-0.5 inline" weight="fill" aria-hidden /> : i === demonstrated ? <Check className="ml-0.5 inline" weight="bold" aria-hidden /> : null}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">
        {left > 0 && days ? `${left} lessons left · about 1 every ${Math.max(1, Math.floor(days / left))} days` : <span className="italic text-ink-500">{push}</span>}
      </p>
    </Link>
  )
}

/** Competing with yourself: this week against last week, and personal records. */
function YouVsYou({ sessions }: { sessions: StudySession[] }) {
  const { thisWeek, lastWeek } = weekVsWeek(sessions)
  const r = records(sessions)
  const max = Math.max(thisWeek, lastWeek, 1)
  const ahead = thisWeek > lastWeek
  const newRecord = r.todayXp > 0 && r.todayXp >= r.bestDay
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold">You vs you</h2>
        <span className={clsx('chip font-bold', ahead ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-flame-100 text-flame-800 dark:bg-flame-900/40 dark:text-flame-200')}>
          {ahead ? <><Trophy weight="fill" aria-hidden /> +{thisWeek - lastWeek} XP ahead</> : `${lastWeek - thisWeek + 1} XP to beat last week`}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        {[['This week', thisWeek, 'bg-brand-500'], ['Last week', lastWeek, 'bg-ink-300 dark:bg-ink-600']].map(([label, v, color]) => (
          <div key={label as string} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-ink-500">{label}</span>
            <Bar value={((v as number) / max) * 100} className="h-3" color={color as string} label={`${label}: ${v} XP`} />
            <span className="w-14 shrink-0 text-right font-bold tabular-nums">{v as number}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className={clsx('rounded-2xl p-2', newRecord ? 'animate-pop bg-flame-100 dark:bg-flame-900/40' : 'bg-ink-50 dark:bg-ink-800')}>
          <p className="font-display text-lg font-extrabold tabular-nums">{r.todayXp}</p><p className="text-[11px] text-ink-500">{newRecord ? <><Fire className="inline text-flame-500" weight="fill" aria-hidden /> record!</> : 'XP today'}</p>
        </div>
        <div className="rounded-2xl bg-ink-50 p-2 dark:bg-ink-800"><p className="font-display text-lg font-extrabold tabular-nums">{r.bestDay}</p><p className="text-[11px] text-ink-500">best day XP</p></div>
        <div className="rounded-2xl bg-ink-50 p-2 dark:bg-ink-800"><p className="font-display text-lg font-extrabold tabular-nums">{bestStreak(sessions)}</p><p className="text-[11px] text-ink-500">best streak</p></div>
      </div>
    </Card>
  )
}
