/**
 * Sets base ELO of 1500 for each math topic on all users.
 * Existing topic ELOs are preserved; missing topics get 1500.
 * Run: node scripts/set-topic-elo-1500.cjs
 * Requires: FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON in .env
 */
const path = require('path')
const fs = require('fs')

// Load .env from project root (parent of scripts/) so it works from any run dir
const projectRoot = path.resolve(__dirname, '..')
const envPath = path.join(projectRoot, '.env')
require('dotenv').config({ path: envPath })

const admin = require('firebase-admin')

const MATH_TOPICS = [
  'algebra', 'linear_algebra', 'calculus', 'real_analysis', 'geometry', 'topology',
  'probability', 'statistics', 'differential_equations', 'number_theory', 'discrete_math',
  'optimization', 'complex_analysis', 'abstract_algebra',
]
const BASE_ELO = 1500

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
    const fullPath = path.isAbsolute(pathOrJson) ? pathOrJson : path.join(projectRoot, pathOrJson)
    if (!fs.existsSync(fullPath)) {
      console.error('Service account file not found:', fullPath)
      process.exit(1)
    }
    credential = admin.credential.cert(JSON.parse(fs.readFileSync(fullPath, 'utf8')))
  }
  if (!admin.apps.length) admin.initializeApp({ credential })
  return admin.firestore()
}

async function run() {
  const firestore = initFirebase()
  const snap = await firestore.collection('users').get()
  let updated = 0
  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const existing = data.topicElo && typeof data.topicElo === 'object' ? data.topicElo : {}
    const topicElo = {}
    for (const t of MATH_TOPICS) {
      topicElo[t] = typeof existing[t] === 'number' ? existing[t] : BASE_ELO
    }
    await docSnap.ref.update({
      topicElo,
      updatedAt: Date.now(),
    })
    updated++
    console.log('Updated', docSnap.id, 'topicElo (base 1500)')
  }
  console.log('Done. Updated', updated, 'user(s).')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
