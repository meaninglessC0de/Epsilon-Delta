/**
 * Migrates existing SQLite data to Firebase Firestore.
 * Run from project root: npm run migrate:to-firebase
 * Requires: FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON in .env or environment.
 * SQLite DB path: data/epsilon_delta.db (relative to cwd).
 */
const path = require('path')
const fs = require('fs')

// Load .env if present
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) {
      const key = m[1]
      let val = (m[2] || '').trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"')
      else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
      process.env[key] = val
    }
  })
}

const admin = require('firebase-admin')

function initFirebase() {
  const pathOrJson = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!pathOrJson) {
    console.error('Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON in .env')
    process.exit(1)
  }
  let credential
  if (pathOrJson.startsWith('{')) {
    credential = admin.credential.cert(JSON.parse(pathOrJson))
  } else {
    const fullPath = path.isAbsolute(pathOrJson) ? pathOrJson : path.join(process.cwd(), pathOrJson)
    if (!fs.existsSync(fullPath)) {
      console.error('Service account file not found:', fullPath)
      process.exit(1)
    }
    credential = admin.credential.cert(JSON.parse(fs.readFileSync(fullPath, 'utf8')))
  }
  if (!admin.apps.length) {
    admin.initializeApp({ credential })
  }
  return admin.firestore()
}

let DatabaseSync
try {
  const sqlite = require('node:sqlite')
  DatabaseSync = sqlite.DatabaseSync
} catch (e) {
  console.error('node:sqlite not available (Node 22+). Install better-sqlite3 or use Node 22:', e.message)
  process.exit(1)
}

const dbPath = path.join(process.cwd(), 'data', 'epsilon_delta.db')
if (!fs.existsSync(dbPath)) {
  console.error('SQLite database not found at', dbPath)
  process.exit(1)
}

const db = new DatabaseSync(dbPath)

const users = db.prepare('SELECT id, email, name, created_at FROM users').all()
const profiles = db.prepare('SELECT user_id, university, study_level, courses, learning_prefs, onboarding_complete, updated_at FROM profiles').all()
const memories = db.prepare('SELECT user_id, topics_covered, weaknesses, solve_summaries, last_updated FROM agent_memory').all()
let solvesRows = []
try {
  solvesRows = db.prepare('SELECT id, user_id, problem, problem_image, status, created_at, completed_at, final_working, final_feedback, feedback_history FROM solves').all()
} catch (e) {
  console.warn('No solves table or error:', e.message)
}

const profileByUserId = Object.fromEntries(profiles.map((p) => [p.user_id, p]))
const memoryByUserId = Object.fromEntries(memories.map((m) => [m.user_id, m]))
const solvesByUserId = {}
solvesRows.forEach((s) => {
  if (!solvesByUserId[s.user_id]) solvesByUserId[s.user_id] = []
  solvesByUserId[s.user_id].push(s)
})

db.close()

const firestore = initFirebase()

function toMetadata(user, profile, memory) {
  return {
    email: user.email.trim(),
    name: user.name || undefined,
    createdAt: user.created_at,
    onboardingComplete: (profile && profile.onboarding_complete === 1) || false,
    university: profile?.university || undefined,
    studyLevel: profile?.study_level || undefined,
    courses: profile ? JSON.parse(profile.courses || '[]') : [],
    learningPrefs: profile ? JSON.parse(profile.learning_prefs || '{}') : {},
    updatedAt: profile?.updated_at || user.created_at,
    topicsCovered: memory ? JSON.parse(memory.topics_covered || '[]') : [],
    weaknesses: memory ? JSON.parse(memory.weaknesses || '[]') : [],
    solveSummaries: memory ? JSON.parse(memory.solve_summaries || '[]') : [],
    lastUpdated: memory?.last_updated || user.created_at,
  }
}

function toSolveDoc(row) {
  return {
    id: row.id,
    problem: row.problem,
    problemImage: row.problem_image || null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
    finalWorking: row.final_working ?? null,
    finalFeedback: row.final_feedback ?? null,
    feedbackHistory: JSON.parse(row.feedback_history || '[]'),
    status: row.status || 'active',
  }
}

function deleteLocalData() {
  const dataDir = path.join(process.cwd(), 'data')
  const files = ['epsilon_delta.db', 'epsilon_delta.db-shm', 'epsilon_delta.db-wal']
  for (const name of files) {
    const filePath = path.join(dataDir, name)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
        console.log('  Deleted', filePath)
      } catch (e) {
        console.warn('  Could not delete', filePath, e.message)
      }
    }
  }
}

async function run() {
  console.log('Migrating', users.length, 'users to Firestore migration_pending...')
  for (const user of users) {
    const email = user.email.toLowerCase().trim()
    const profile = profileByUserId[user.id]
    const memory = memoryByUserId[user.id]
    const meta = toMetadata(user, profile, memory)
    const ref = firestore.collection('migration_pending').doc(email)
    await ref.set(meta)
    console.log('  ', email, '-> metadata')

    const solves = solvesByUserId[user.id] || []
    for (const row of solves) {
      const solveRef = ref.collection('solves').doc(row.id)
      await solveRef.set(toSolveDoc(row))
    }
    if (solves.length) console.log('    ', solves.length, 'solves')
  }
  console.log('Transfer complete.')

  const keepLocal = process.env.KEEP_LOCAL_DATA === 'true' || process.env.KEEP_LOCAL_DATA === '1'
  if (keepLocal) {
    console.log('Skipping local data deletion (KEEP_LOCAL_DATA is set).')
  } else {
    console.log('Deleting local server data...')
    deleteLocalData()
    console.log('Local data deleted.')
  }
  console.log('Users should sign in with Firebase Auth (same email) to copy data to their account.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
