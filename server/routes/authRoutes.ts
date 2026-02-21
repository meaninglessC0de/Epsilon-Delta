import { Router, Request, Response } from 'express'
import { getDb } from '../db'
import { hashPassword, verifyPassword, signToken } from '../auth'
import { requireAuth, AuthRequest } from '../middleware/requireAuth'
import type { User, AuthResponse, MeResponse } from '../../shared/types'

const router = Router()

interface UserRow {
  id: number
  email: string
  name: string | null
  created_at: number
}

interface ProfileRow {
  onboarding_complete: number
}

function rowToUser(row: UserRow): User {
  return { id: row.id, email: row.email, name: row.name ?? undefined, createdAt: row.created_at }
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  const db = getDb()

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists' })
    return
  }

  try {
    const passwordHash = await hashPassword(password)

    const trimmedName = name?.trim() || null
    const insertUser = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
    const result = insertUser.run(email.toLowerCase().trim(), trimmedName, passwordHash)
    const userId = Number(result.lastInsertRowid)

    db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(userId)
    db.prepare('INSERT INTO agent_memory (user_id) VALUES (?)').run(userId)

    const userRow = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(userId) as unknown as UserRow

    const token = signToken(userId)
    const response: AuthResponse = {
      token,
      user: rowToUser(userRow),
      onboardingComplete: false,
    }

    res.status(201).json(response)
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  const db = getDb()

  const userRow = db.prepare(
    'SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?'
  ).get(email.toLowerCase().trim()) as unknown as (UserRow & { password_hash: string }) | undefined

  if (!userRow) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  try {
    const valid = await verifyPassword(password, userRow.password_hash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const profileRow = db.prepare(
      'SELECT onboarding_complete FROM profiles WHERE user_id = ?'
    ).get(userRow.id) as unknown as ProfileRow | undefined

    const token = signToken(userRow.id)
    const response: AuthResponse = {
      token,
      user: rowToUser(userRow),
      onboardingComplete: profileRow?.onboarding_complete === 1,
    }

    res.json(response)
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.userId!
  const db = getDb()

  const userRow = db.prepare(
    'SELECT id, email, name, created_at FROM users WHERE id = ?'
  ).get(userId) as unknown as UserRow | undefined

  if (!userRow) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const profileRow = db.prepare(
    'SELECT onboarding_complete FROM profiles WHERE user_id = ?'
  ).get(userId) as unknown as ProfileRow | undefined

  const response: MeResponse = {
    user: rowToUser(userRow),
    onboardingComplete: profileRow?.onboarding_complete === 1,
  }

  res.json(response)
})

export default router
