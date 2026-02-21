import admin from 'firebase-admin'
import path from 'path'

let initialized = false

export function initFirebaseAdmin(): void {
  if (initialized || admin.apps.length > 0) {
    initialized = true
    return
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()

  try {
    if (serviceAccountJson) {
      const sa = JSON.parse(serviceAccountJson) as admin.ServiceAccount
      admin.initializeApp({ credential: admin.credential.cert(sa) })
    } else if (serviceAccountPath) {
      // Path in .env may use backslashes (Windows-style) — normalise
      const normalised = serviceAccountPath.replace(/\\/g, '/')
      // Path is relative to the project root (one level above server/)
      const absolute = path.resolve(__dirname, '..', normalised)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sa = require(absolute) as admin.ServiceAccount
      admin.initializeApp({ credential: admin.credential.cert(sa) })
    } else {
      // Fall back to Application Default Credentials (e.g. on GCP)
      admin.initializeApp()
    }
    initialized = true
    console.log('[firebase-admin] Initialised')
  } catch (err) {
    console.error('[firebase-admin] Init failed:', err)
    throw err
  }
}

export { admin }
