/**
 * Updates existing Firestore user documents to include new metadata fields.
 * Run from project root: node scripts/update-firebase-metadata-schema.cjs
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

const DEFAULTS = {
  onboardingStep: 0,
  mathTopics: [],
  topicElo: {},
  learningDisabilities: [],
  preferenceScores: {},
  totalSolves: 0,
  lastActiveAt: 0,
  sessionCount: 0,
}

async function run() {
  const firestore = initFirebase()
  const snap = await firestore.collection('users').get()
  let updated = 0
  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const updates = {}
    for (const [key, defaultVal] of Object.entries(DEFAULTS)) {
      if (data[key] === undefined) {
        updates[key] = defaultVal
      }
    }
    if (Object.keys(updates).length > 0) {
      await docSnap.ref.update(updates)
      updated++
      console.log('Updated', docSnap.id, Object.keys(updates))
    }
  }
  console.log('Done. Updated', updated, 'user(s).')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
