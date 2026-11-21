import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addStudyTime } from '../lib/repo'

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

/** Counts real study time: only while a learning screen is mounted AND the tab is visible. */
export function useStudyTimer(active = true) {
  useEffect(() => {
    if (!active) return
    let last = Date.now()
    const tick = () => {
      const now = Date.now()
      if (document.visibilityState === 'visible') {
        const sec = Math.min(30, Math.round((now - last) / 1000))
        if (sec > 0) void addStudyTime(sec)
      }
      last = now
    }
    const id = setInterval(tick, 15_000)
    const vis = () => (last = Date.now())
    document.addEventListener('visibilitychange', vis)
    return () => {
      tick()
      clearInterval(id)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [active])
}

export const useProfile = () => useLiveQuery(() => db.profile.get('me'), [], null)

export function useTheme() {
  const profile = useProfile()
  useEffect(() => {
    const pref = profile?.theme ?? 'system'
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', pref === 'dark' || (pref === 'system' && mq.matches))
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [profile?.theme])
}
