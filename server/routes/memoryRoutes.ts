import { Router, Response } from 'express'
import { getDb } from '../db'
import { requireAuth, AuthRequest } from '../middleware/requireAuth'
import type { AgentMemory } from '../../shared/types'

const router = Router()

interface MemoryRow {
  user_id: number
  topics_covered: string
  weaknesses: string
  solve_summaries: string
  last_updated: number
}

function rowToMemory(row: MemoryRow): AgentMemory {
  return {
    userId: String(row.user_id),
    topicsCovered: JSON.parse(row.topics_covered) as string[],
    weaknesses: JSON.parse(row.weaknesses) as string[],
    solveSummaries: JSON.parse(row.solve_summaries) as string[],
    lastUpdated: row.last_updated,
  }
}

// GET /api/memory
router.get('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.userId!
  const db = getDb()

  const row = db.prepare(
    'SELECT user_id, topics_covered, weaknesses, solve_summaries, last_updated FROM agent_memory WHERE user_id = ?'
  ).get(userId) as unknown as MemoryRow | undefined

  if (!row) {
    res.status(404).json({ error: 'Memory not found' })
    return
  }

  res.json(rowToMemory(row))
})

// PUT /api/memory
router.put('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.userId!
  const { topicsCovered, weaknesses, solveSummaries } = req.body as {
    topicsCovered?: string[]
    weaknesses?: string[]
    solveSummaries?: string[]
  }

  const db = getDb()

  db.prepare(`
    UPDATE agent_memory SET
      topics_covered  = COALESCE(?, topics_covered),
      weaknesses      = COALESCE(?, weaknesses),
      solve_summaries = COALESCE(?, solve_summaries),
      last_updated    = unixepoch()
    WHERE user_id = ?
  `).run(
    topicsCovered  !== undefined ? JSON.stringify(topicsCovered)  : null,
    weaknesses     !== undefined ? JSON.stringify(weaknesses)     : null,
    solveSummaries !== undefined ? JSON.stringify(solveSummaries) : null,
    userId
  )

  res.json({ ok: true })
})

export default router
