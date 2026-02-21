import { Router, Response } from 'express'
import { getDb } from '../db'
import { requireAuth, AuthRequest } from '../middleware/requireAuth'
import type { Profile } from '../../shared/types'

const router = Router()

interface ProfileRow {
  user_id: number
  university: string | null
  study_level: string | null
  courses: string
  learning_prefs: string
  onboarding_complete: number
  updated_at: number
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    university: row.university ?? undefined,
    studyLevel: row.study_level ?? undefined,
    courses: JSON.parse(row.courses) as string[],
    learningPrefs: JSON.parse(row.learning_prefs) as Record<string, boolean>,
    onboardingComplete: row.onboarding_complete === 1,
    updatedAt: row.updated_at,
  }
}

// GET /api/profile
router.get('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.userId!
  const db = getDb()

  const row = db.prepare(
    'SELECT user_id, university, study_level, courses, learning_prefs, onboarding_complete, updated_at FROM profiles WHERE user_id = ?'
  ).get(userId) as unknown as ProfileRow | undefined

  if (!row) {
    res.status(404).json({ error: 'Profile not found' })
    return
  }

  res.json(rowToProfile(row))
})

// PUT /api/profile
router.put('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.userId!
  const { university, studyLevel, courses, learningPrefs } = req.body as {
    university?: string
    studyLevel?: string
    courses?: string[]
    learningPrefs?: Record<string, boolean>
  }

  const db = getDb()

  db.prepare(`
    UPDATE profiles SET
      university = COALESCE(?, university),
      study_level = COALESCE(?, study_level),
      courses = COALESCE(?, courses),
      learning_prefs = COALESCE(?, learning_prefs),
      onboarding_complete = 1,
      updated_at = unixepoch()
    WHERE user_id = ?
  `).run(
    university ?? null,
    studyLevel ?? null,
    courses !== undefined ? JSON.stringify(courses) : null,
    learningPrefs !== undefined ? JSON.stringify(learningPrefs) : null,
    userId
  )

  res.json({ ok: true })
})

export default router
