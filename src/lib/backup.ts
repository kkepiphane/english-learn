import { db, type EnglishPathDB } from '../db/db'

/**
 * Backup / restore. Everything the learner owns lives in IndexedDB on this device only,
 * so this file is the user's only way to move data between devices or survive a browser reset.
 * Audio recordings are embedded as base64 so the backup is one self-contained JSON file.
 */
export const BACKUP_FORMAT = 'english-path-backup'
export const BACKUP_VERSION = 1

const TABLES = ['profile', 'attempts', 'lessonProgress', 'assessments', 'cards', 'sessions', 'writings', 'recordings', 'kv'] as const
type TableName = (typeof TABLES)[number]

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  app: string
  data: Partial<Record<TableName, unknown[]>>
}

const blobToBase64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })

const base64ToBlob = (b64: string, mime: string) => {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function buildBackup(database: EnglishPathDB = db, opts: { includeAudio?: boolean } = {}): Promise<BackupFile> {
  const data: BackupFile['data'] = {}
  for (const t of TABLES) {
    if (t === 'recordings') {
      if (opts.includeAudio === false) continue
      const recs = await database.recordings.toArray()
      data.recordings = await Promise.all(recs.map(async (r) => ({ ...r, blob: await blobToBase64(r.blob) })))
    } else if (t === 'kv') {
      // Never export secrets (e.g. a personal AI proxy token).
      data.kv = (await database.kv.toArray()).filter((k) => !k.key.startsWith('secret.'))
    } else {
      data[t] = await (database[t] as import('dexie').Table).toArray()
    }
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), app: 'English Path', data }
}

export async function downloadBackup(includeAudio = true) {
  const b = await buildBackup(db, { includeAudio })
  const blob = new Blob([JSON.stringify(b)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `english-path-backup-${b.exportedAt.slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  await db.kv.put({ key: 'backup.last', value: Date.now() })
}

export function validateBackup(raw: unknown): BackupFile {
  const b = raw as BackupFile
  if (!b || b.format !== BACKUP_FORMAT) throw new Error('This file is not an English Path backup.')
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) throw new Error('This backup was made by a newer version of the app. Update the app first.')
  if (!b.data || typeof b.data !== 'object') throw new Error('The backup is empty or damaged.')
  return b
}

export type RestoreMode = 'replace' | 'merge'

/**
 * - replace: wipe local data, then load the backup (restore on a new device).
 * - merge:   keep local data; append history (attempts, assessments, writings, recordings are keyed by UUID → no duplicates),
 *            and for mutable records (profile, cards, lesson progress, sessions) keep the most recently updated version.
 * Runs in one transaction: if anything fails, local data is untouched.
 */
export async function restoreBackup(raw: unknown, mode: RestoreMode, database: EnglishPathDB = db) {
  const b = validateBackup(raw)
  const d = b.data
  const recordings = (d.recordings as (Record<string, unknown> & { blob: string; mime: string })[] | undefined)?.map((r) => ({
    ...r,
    blob: base64ToBlob(r.blob, r.mime),
  }))
  const counts: Record<string, number> = {}
  await database.transaction('rw', TABLES.map((t) => database[t]), async () => {
    if (mode === 'replace') for (const t of TABLES) await database[t].clear()
    const newer = async <T extends { updatedAt?: number }>(table: import('dexie').Table<T>, rows: T[] | undefined, key: (r: T) => string) => {
      for (const r of rows ?? []) {
        const cur = mode === 'merge' ? await table.get(key(r) as never) : undefined
        if (!cur || (r.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) await table.put(r)
      }
      counts[table.name] = rows?.length ?? 0
    }
    const append = async (table: import('dexie').Table, rows: unknown[] | undefined) => {
      if (rows?.length) await table.bulkPut(rows)
      counts[table.name] = rows?.length ?? 0
    }
    await newer(database.profile, d.profile as never, (r: { id: string }) => r.id)
    await newer(database.cards, d.cards as never, (r: { id: string }) => r.id)
    await newer(database.lessonProgress, d.lessonProgress as never, (r: { lessonId: string }) => r.lessonId)
    // Sessions: merge by day, keeping the larger study time.
    for (const s of (d.sessions ?? []) as { day: string; seconds: number; xp: number }[]) {
      const cur = mode === 'merge' ? await database.sessions.get(s.day) : undefined
      await database.sessions.put(cur ? { day: s.day, seconds: Math.max(cur.seconds, s.seconds), xp: Math.max(cur.xp, s.xp) } : s)
    }
    counts.sessions = d.sessions?.length ?? 0
    await append(database.attempts, d.attempts)
    await append(database.assessments, d.assessments)
    await append(database.writings, d.writings)
    await append(database.recordings, recordings)
    if (mode === 'replace') await append(database.kv, d.kv)
  })
  return counts
}
