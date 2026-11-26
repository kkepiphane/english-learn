import { db } from '../db/db'
import type { RewardData } from './rewards'
import { loadReviewStates, reviewsDone } from './review'
import type { UnitTestRecord } from './unitTest'

/** Everything badges are computed from, read from the database (shared by Home, Progress and the badge watcher). */
export async function loadRewardData(): Promise<RewardData> {
  const unitRows = await db.kv.where('key').startsWith('unittest.').toArray()
  return {
    sessions: await db.sessions.toArray(),
    progress: await db.lessonProgress.toArray(),
    cards: await db.cards.toArray(),
    writings: await db.writings.toArray(),
    assessments: await db.assessments.toArray(),
    recordings: await db.recordings.count(),
    unitTests: unitRows.filter((r) => (r.value as UnitTestRecord).passed).length,
    reviews: reviewsDone(await loadReviewStates()),
  }
}
