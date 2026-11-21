import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * Update strategy: a new service worker waits until the learner accepts the update,
 * so an exercise in progress is never interrupted by a reload.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [update, setUpdate] = useState<((reload?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const fn = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => {
        setOfflineReady(true)
        setTimeout(() => setOfflineReady(false), 6000)
      },
      onRegisteredSW: (_url, reg) => reg && setInterval(() => void reg.update(), 60 * 60_000),
    })
    setUpdate(() => fn)
    // Ask the browser not to evict our IndexedDB data under storage pressure.
    void navigator.storage?.persist?.()
  }, [])

  if (!needRefresh && !offlineReady) return null
  return (
    <div role="status" className="fixed inset-x-3 bottom-20 z-30 mx-auto max-w-md rounded-2xl bg-ink-900 p-4 text-white shadow-xl md:bottom-6">
      {needRefresh ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">A new version of English Path is available.</p>
          <div className="flex gap-2">
            <button className="btn bg-white/10 text-white" onClick={() => setNeedRefresh(false)}>Later</button>
            <button className="btn bg-white text-ink-900" onClick={() => void update?.(true)}>Update</button>
          </div>
        </div>
      ) : (
        <p className="text-sm">✓ English Path is ready to work offline.</p>
      )}
    </div>
  )
}
