import { describe, it, expect } from 'vitest'
import { ghostAt, MIX_ID, saveRun, getRecord, sprintItems } from './sprint'
import { BASICS } from '../content'

describe('sprint', () => {
  it('the ghost replays the best run at the same pace', () => {
    const rec = { best: 3, times: [2000, 5000, 9000] }
    expect([ghostAt(rec, 0), ghostAt(rec, 2000), ghostAt(rec, 8000), ghostAt(rec, 60000)]).toEqual([0, 1, 2, 3])
    expect(ghostAt(undefined, 5000)).toBe(0)
  })
  it('the mixed sprint uses every A1 item, a sheet sprint only its own', () => {
    expect(sprintItems(MIX_ID, 1)).toHaveLength(BASICS.flatMap((b) => b.items).length)
    expect(sprintItems('a1-be', 1).every((i) => i.id.startsWith('a1be-'))).toBe(true)
  })
  it('keeps only better runs as the record', async () => {
    expect(await saveRun('t-sheet', [1000, 2000])).toBe(true)
    expect(await saveRun('t-sheet', [500])).toBe(false)
    expect((await getRecord('t-sheet'))?.best).toBe(2)
    expect(await saveRun('t-sheet', [1, 2, 3])).toBe(true)
  })
})

describe('sprint kinds', () => {
  it('every level, skill and unit sprint has items', async () => {
    const { LEVELS } = await import('../content/types')
    const { UNITS } = await import('../content')
    const { sprintInfo, levelSprintId, skillSprintId, unitSprintId } = await import('./sprint')
    for (const l of LEVELS) for (const id of [levelSprintId(l), skillSprintId(l, 'gram'), skillSprintId(l, 'vocab')]) expect(sprintInfo(id)?.pool.length, id).toBeGreaterThan(5)
    for (const u of UNITS) expect(sprintInfo(unitSprintId(u.id))?.pool.length, u.id).toBeGreaterThan(3)
    expect(sprintInfo('nope')).toBeUndefined()
  })
})
