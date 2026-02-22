/**
 * Migrates whiteboard data from solve documents into the dedicated whiteboards collection.
 * Path: users/{uid}/whiteboards/{solveId} — stores who made the whiteboard and all whiteboard data.
 *
 * Run from project root: node scripts/migrate-whiteboards-to-collection.cjs
 * Requires: FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON in .env
 */
const path = require('path')
const fs = require('fs')

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
  if (!admin.apps.length) admin.initializeApp({ credential })
  return admin.firestore()
}

function toWhiteboardStateString(ws) {
  if (typeof ws === 'string') return ws
  if (ws && typeof ws === 'object' && Array.isArray(ws.elements)) {
    return JSON.stringify({ elements: ws.elements, appState: ws.appState || {} })
  }
  return null
}

async function run() {
  const firestore = initFirebase()
  const usersSnap = await firestore.collection('users').get()
  let totalSolves = 0
  let totalMigrated = 0
  let totalSkipped = 0

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id
    const solvesRef = firestore.collection('users').doc(uid).collection('solves')
    const solvesSnap = await solvesRef.get()

    for (const solveDoc of solvesSnap.docs) {
      const solveId = solveDoc.id
      const data = solveDoc.data()
      totalSolves++

      const ws = data.whiteboardState
      const stateStr = toWhiteboardStateString(ws)
      if (!stateStr) {
        totalSkipped++
        continue
      }

      const whiteboardRef = firestore.collection('users').doc(uid).collection('whiteboards').doc(solveId)
      const existing = await whiteboardRef.get()
      const now = Date.now()
      const createdAt = existing.exists ? (existing.data().createdAt || now) : now

      await whiteboardRef.set({
        userId: uid,
        solveId,
        whiteboardState: stateStr,
        createdAt,
        updatedAt: now,
      }, { merge: true })

      totalMigrated++
      console.log(`  Migrated whiteboard: user ${uid.slice(0, 8)}… solve ${solveId.slice(0, 8)}…`)
    }
  }

  console.log(`Done. Solves scanned: ${totalSolves}, whiteboards written: ${totalMigrated}, skipped (no state): ${totalSkipped}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
