import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { db, today } from '../db/db'
import { useProfile } from '../hooks/hooks'
import { Card, Bar, Ring, LevelBadge, PageTitle } from '../components/ui'
import { computeStreak, lastNDays, xpLevel } from '../lib/stats'
import { allMastery, coachMessage, dailyChallenges, learningLevel, nextLesson, weakestSkills, weeklyChallenges } from '../lib/recommend'
import { STATUS_COLOR, STATUS_LABEL } from '../lib/mastery'
import { lessonsFor, getLesson } from '../content'
import { CORE_SKILLS, CROSS_SKILLS, LEVELS } from '../content/types'
import clsx from 'clsx'

export default function Home() {
  const profile = useProfile()
  const data = useLiveQuery(async () => ({
    sessions: await db.sessions.toArray(),
    attempts: await db.attempts.toArray(),
    progress: await db.lessonProgress.toArray(),
    cards: await db.cards.toArray(),
    writings: await db.writings.toArray(),
    placement: await db.kv.get('placement.done'),
  }))
  if (!profile || !data) return null

  const level = learningLevel(profile)
  const streak = computeStreak(data.sessions)
  const todayS = data.sessions.find((s) => s.day === today())
  const minutesToday = Math.round((todayS?.seconds ?? 0) / 60)
  const week = lastNDays(data.sessions, 7)
  const totalXp = data.sessions.reduce((a, s) => a + s.xp, 0)
  const xp = xpLevel(totalXp)
  const mastery = allMastery(data.attempts)
  const weak = weakestSkills(mastery)
  const next = nextLesson(level, data.progress)
  const levelLessons = lessonsFor(level)
  const done = new Set(data.progress.filter((p) => p.status === 'completed').map((p) => p.lessonId))
  const levelPct = levelLessons.length ? (levelLessons.filter((l) => done.has(l.id)).length / levelLessons.length) * 100 : 0
  const pending = data.progress.filter((p) => p.status === 'started').map((p) => getLesson(p.lessonId)).filter(Boolean)
  const due = data.cards.filter((c) => c.due <= Date.now()).length
  const daily = dailyChallenges(data.sessions, data.attempts, data.cards, profile.dailyGoalMin)
  const weekly = weeklyChallenges(data.sessions, data.writings, data.attempts)
  const lastActive = [...data.sessions].filter((s) => s.seconds >= 60).sort((a, b) => b.day.localeCompare(a.day))[0]?.day
  const goalIdx = LEVELS.indexOf(profile.goalLevel), curIdx = profile.currentLevel && profile.currentLevel !== 'pre-A2' ? LEVELS.indexOf(profile.currentLevel) + 1 : 0
  const overall = Math.min(100, (curIdx / (goalIdx + 1)) * 100 + (levelPct / (goalIdx + 1)) * 0.5)

  return (
    <div className="space-y-4">
      <PageTitle title={`Hi ${profile.name} 👋`} subtitle={coachMessage(streak, minutesToday, profile.dailyGoalMin, lastActive)} />

      {!data.placement && (
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-900/30">
          <p className="font-semibold">Find your real level</p>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">Take the 12-minute level test so your path starts at the right place.</p>
          <Link to="/placement" className="btn-primary mt-3">Take the level test</Link>
        </Card>
      )}

      {/* Today */}
      <Card className="flex items-center gap-5">
        <Ring value={(minutesToday / profile.dailyGoalMin) * 100} label={`${minutesToday} of ${profile.dailyGoalMin} minutes today`}>
          <span className="text-xl font-bold tabular-nums">{minutesToday}</span>
          <span className="text-[10px] text-ink-400">/ {profile.dailyGoalMin} min</span>
        </Ring>
        <div className="grid flex-1 grid-cols-3 gap-2 text-center">
          <div><p className="text-2xl font-bold tabular-nums">🔥 {streak}</p><p className="text-xs text-ink-400">day streak</p></div>
          <div><p className="text-2xl font-bold tabular-nums">{xp.lvl}</p><p className="text-xs text-ink-400">XP level</p><Bar value={(xp.into / xp.need) * 100} className="mt-1 h-1" label="XP to next level" /></div>
          <div><p className="text-2xl font-bold tabular-nums">{due}</p><p className="text-xs text-ink-400">cards due</p></div>
        </div>
      </Card>

      {/* Level */}
      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="label">Demonstrated</p><LevelBadge level={profile.currentLevel ?? '?'} className="mt-1.5 text-sm" /></div>
          <div><p className="label">Working on</p><LevelBadge level={level} className="mt-1.5 bg-brand-100 text-sm text-brand-800 dark:bg-brand-900 dark:text-brand-200" /></div>
          <div><p className="label">Goal</p><LevelBadge level={profile.goalLevel} className="mt-1.5 bg-ink-800 text-sm dark:bg-ink-700" /></div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm"><span className="w-28 text-ink-500">{level} path</span><Bar value={levelPct} label={`${level} path progress`} /><span className="w-10 text-right tabular-nums">{Math.round(levelPct)}%</span></div>
        <div className="mt-2 flex items-center gap-3 text-sm"><span className="w-28 text-ink-500">Towards {profile.goalLevel}</span><Bar value={overall} color="bg-ink-700 dark:bg-ink-400" label="Overall progress to goal" /><span className="w-10 text-right tabular-nums">{Math.round(overall)}%</span></div>
      </Card>

      {/* What to do today */}
      <section aria-labelledby="today-h">
        <h2 id="today-h" className="mb-2 mt-6 text-lg font-bold">What should I learn today?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {next ? (
            <Link to={`/learn/lesson/${next.id}`} className="card block p-4 transition hover:border-brand-300">
              <p className="label">Next lesson · {next.level}</p>
              <p className="mt-1 font-semibold">{next.title}</p>
              <p className="mt-1 text-sm text-ink-500">{next.objective}</p>
              <p className="mt-2 text-xs text-ink-400">≈ {next.minutes} min</p>
            </Link>
          ) : (
            <Link to={`/learn/checkpoint/${level}`} className="card block p-4">
              <p className="label">All {level} lessons done</p>
              <p className="mt-1 font-semibold">Take the {level} checkpoint to prove your level</p>
            </Link>
          )}
          {due > 0 ? (
            <Link to="/practice/flashcards" className="card block p-4"><p className="label">Spaced review</p><p className="mt-1 font-semibold">{due} flashcard{due > 1 ? 's' : ''} to review</p><p className="mt-1 text-sm text-ink-500">Difficult words come back more often.</p></Link>
          ) : (
            <Link to="/practice" className="card block p-4"><p className="label">Practice</p><p className="mt-1 font-semibold">Reading, listening or writing</p><p className="mt-1 text-sm text-ink-500">Train a skill with a real text or audio.</p></Link>
          )}
        </div>
        {pending.length > 0 && (
          <Card className="mt-3"><p className="label">In progress</p>
            <ul className="mt-2 space-y-1">{pending.map((l) => <li key={l!.id}><Link className="text-sm font-medium text-brand-600 dark:text-brand-400" to={`/learn/lesson/${l!.id}`}>Finish: {l!.title} →</Link></li>)}</ul>
          </Card>
        )}
      </section>

      {/* Skills */}
      <section aria-labelledby="skills-h">
        <h2 id="skills-h" className="mb-2 mt-6 text-lg font-bold">Skills</h2>
        <Card className="space-y-2.5">
          {[...CORE_SKILLS, ...CROSS_SKILLS].map((s) => {
            const m = mastery.find((x) => x.skill === s)!
            return (
              <div key={s} className="flex items-center gap-3 text-sm">
                <span className={clsx('w-28 capitalize', CROSS_SKILLS.includes(s) && 'text-ink-500')}>{s}</span>
                <Bar value={m.score} />
                <span className={clsx('chip w-24 justify-center', STATUS_COLOR[m.status])}>{STATUS_LABEL[m.status]}</span>
              </div>
            )
          })}
          {weak.length > 0 && <p className="pt-2 text-sm text-ink-500">Focus next: <span className="font-semibold capitalize text-ink-800 dark:text-ink-100">{weak.map((w) => w.skill).join(', ')}</span></p>}
        </Card>
      </section>

      {/* Challenges */}
      <section className="grid gap-3 sm:grid-cols-2" aria-label="Challenges">
        {[{ t: 'Daily challenges', c: daily }, { t: 'Weekly challenges', c: weekly }].map(({ t, c }) => (
          <Card key={t}>
            <p className="label">{t}</p>
            <ul className="mt-2 space-y-2.5">{c.map((x) => (
              <li key={x.id} className="text-sm">
                <div className="flex justify-between"><span>{x.done >= x.target ? '✅' : '◻️'} {x.label}</span><span className="tabular-nums text-ink-400">{Math.min(x.done, x.target)}/{x.target}</span></div>
                <Bar value={(x.done / x.target) * 100} className="mt-1 h-1.5" color={x.done >= x.target ? 'bg-emerald-500' : 'bg-brand-600'} label={x.label} />
              </li>
            ))}</ul>
          </Card>
        ))}
      </section>

      {/* Weekly chart */}
      <Card>
        <p className="label mb-3">This week (minutes)</p>
        <div className="h-40" role="img" aria-label={`Minutes studied in the last 7 days: ${week.map((d) => `${d.label} ${d.minutes}`).join(', ')}`}>
          <ResponsiveContainer>
            <BarChart data={week}>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis width={28} tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
              <Tooltip cursor={{ fillOpacity: 0.06 }} />
              <RBar dataKey="minutes" fill="#1b5cf5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
