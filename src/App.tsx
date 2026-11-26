import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, type ReactNode } from 'react'
import { db } from './db/db'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import Home from './pages/Home'
import Onboarding from './pages/Onboarding'

const Placement = lazy(() => import('./pages/Placement'))
const Learn = lazy(() => import('./pages/Learn'))
const LessonPage = lazy(() => import('./pages/LessonPage'))
const Checkpoint = lazy(() => import('./pages/Checkpoint'))
const Practice = lazy(() => import('./pages/Practice'))
const ReadingPage = lazy(() => import('./pages/ReadingPage'))
const ListeningPage = lazy(() => import('./pages/ListeningPage'))
const WritingPage = lazy(() => import('./pages/WritingPage'))
const Flashcards = lazy(() => import('./pages/Flashcards'))
const Speaking = lazy(() => import('./pages/Speaking'))
const Exams = lazy(() => import('./pages/Exams'))
const Progress = lazy(() => import('./pages/Progress'))
const Profile = lazy(() => import('./pages/Profile'))
const Goal = lazy(() => import('./pages/Goal'))
const SheetPage = lazy(() => import('./pages/Basics'))
const Sprint = lazy(() => import('./pages/Sprint'))

const Loading = () => <div className="flex h-40 items-center justify-center text-sm text-ink-400" role="status">Loading…</div>

/** Until a profile exists, everything redirects to onboarding. */
function Gate({ children }: { children: ReactNode }) {
  const profile = useLiveQuery(() => db.profile.get('me'), [], 'loading' as const)
  const loc = useLocation()
  if (profile === 'loading') return <Loading />
  // /placement is reachable right after onboarding, before the live query has seen the new profile.
  if (!profile && !['/welcome', '/placement'].includes(loc.pathname)) return <Navigate to="/welcome" replace />
  return <>{children}</>
}

// HashRouter: deep links work on GitHub Pages (no server-side rewrite needed) and offline.
export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <Gate>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/welcome" element={<Onboarding />} />
              <Route path="/placement" element={<Placement />} />
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="learn" element={<Learn />} />
                <Route path="learn/lesson/:id" element={<LessonPage />} />
                <Route path="learn/checkpoint/:level" element={<Checkpoint />} />
                <Route path="practice" element={<Practice />} />
                <Route path="practice/reading/:id" element={<ReadingPage />} />
                <Route path="practice/listening/:id" element={<ListeningPage />} />
                <Route path="practice/writing/:id" element={<WritingPage />} />
                <Route path="practice/flashcards" element={<Flashcards />} />
                <Route path="speaking" element={<Speaking />} />
                <Route path="exams" element={<Exams />} />
                <Route path="progress" element={<Progress />} />
                <Route path="profile" element={<Profile />} />
                <Route path="goal" element={<Goal />} />
                <Route path="basics/:id" element={<SheetPage />} />
                <Route path="basics/sprint/:id" element={<Sprint />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </Gate>
      </ErrorBoundary>
    </HashRouter>
  )
}
