/**
 * Backfills academicLevel and academicLevelBreakdown for all users from their
 * studyLevel, courses, university, mathTopics. Uses same rating algorithm as shared/academicLevel.
 * Run: node scripts/backfill-academic-level.cjs
 */
const path = require('path')
const projectRoot = path.resolve(__dirname, '..')
require('dotenv').config({ path: path.join(projectRoot, '.env') })

const admin = require('firebase-admin')

function initFirebase() {
  const pathOrJson = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!pathOrJson) {
    console.error('Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON in .env')
    process.exit(1)
  }
  const cred = pathOrJson.startsWith('{')
    ? admin.credential.cert(JSON.parse(pathOrJson))
    : admin.credential.cert(JSON.parse(require('fs').readFileSync(path.isAbsolute(pathOrJson) ? pathOrJson : path.join(projectRoot, pathOrJson), 'utf8')))
  if (!admin.apps.length) admin.initializeApp({ credential: cred })
  return admin.firestore()
}

const STUDY = { undergraduate: 28, postgraduate: 62, other: 18, phd: 85, masters: 58, bachelor: 30 }
const ADVANCED = new Set(['real_analysis', 'abstract_algebra', 'topology', 'complex_analysis', 'differential_equations', 'optimization', 'number_theory'])
const TIERS = [
  { keywords: ['mit', 'stanford', 'harvard', 'caltech', 'princeton', 'oxford', 'cambridge', 'eth zurich', 'imperial college'], bonus: 30 },
  { keywords: ['berkeley', 'ucla', 'yale', 'columbia', 'chicago', 'cornell', 'upenn', 'duke', 'northwestern', 'johns hopkins'], bonus: 26 },
  { keywords: ['carnegie mellon', 'georgia tech', 'michigan', 'toronto', 'ucl', 'edinburgh', 'melbourne', 'sydney', 'national university singapore', 'hong kong'], bonus: 22 },
  { keywords: ['iit ', 'indian institute of technology', 'bits pilani', 'tsinghua', 'beijing', 'tokyo', 'kyoto', 'seoul national', 'delft', 'tu munich'], bonus: 20 },
  { keywords: ['university of', 'college', 'institute', 'school of'], bonus: 10 },
]

function compute(data) {
  const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ')
  let studyLevel = 20
  if (data.studyLevel) {
    const k = data.studyLevel.toLowerCase()
    for (const [key, v] of Object.entries(STUDY)) {
      if (k.includes(key)) { studyLevel = v; break }
    }
  }
  const n = Array.isArray(data.courses) ? data.courses.length : 0
  const courseLoad = n === 0 ? 5 : Math.min(100, Math.round((Math.min(96, n * 12) / 96) * 100))
  let institution = 35
  if (data.university) {
    const u = norm(data.university)
    institution = 50
    for (const { keywords, bonus } of TIERS) {
      for (const kw of keywords) {
        if (u.includes(kw)) { institution = Math.min(100, 50 + bonus); break }
      }
    }
  }
  const topics = Array.isArray(data.mathTopics) ? data.mathTopics : []
  let raw = 0
  for (const t of topics) {
    raw += ADVANCED.has((t || '').toLowerCase()) ? 14 : 6
  }
  const topicDepth = topics.length === 0 ? 10 : Math.min(100, Math.round((raw / 100) * 100))
  const academicLevel = Math.round(Math.max(0, Math.min(100,
    0.28 * studyLevel + 0.25 * courseLoad + 0.27 * institution + 0.2 * topicDepth)))
  return {
    academicLevel,
    academicLevelBreakdown: { studyLevel, courseLoad, institution, topicDepth },
  }
}

async function run() {
  const firestore = initFirebase()
  const snap = await firestore.collection('users').get()
  let updated = 0
  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const { academicLevel, academicLevelBreakdown } = compute(data)
    await docSnap.ref.update({ academicLevel, academicLevelBreakdown })
    updated++
    console.log(docSnap.id, '->', academicLevel, academicLevelBreakdown)
  }
  console.log('Done. Backfilled', updated, 'user(s).')
}

run().catch((err) => { console.error(err); process.exit(1) })
