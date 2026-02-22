import admin from 'firebase-admin'
import path from 'path'

let initialized = false
let ready = false

export function isFirebaseReady(): boolean {
  return ready
}

export function initFirebaseAdmin(): void {
  if (initialized) return
  initialized = true

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  const defaultPath = path.join(__dirname, 'epsilon-del-firebase-adminsdk-fbsvc-ee6e789edc.json')

  try {
    if (admin.apps.length > 0) {
      ready = true
      console.log('[firebase-admin] Already initialised')
      return
    }
    // Prefer path (more reliable; .env multiline JSON is often broken)
    let absolute: string | null = null
    if (serviceAccountPath) {
      const normalised = serviceAccountPath.replace(/\\/g, '/')
      absolute = path.isAbsolute(normalised) ? normalised : path.resolve(__dirname, '..', normalised)
    } else if (require('fs').existsSync(defaultPath)) {
      absolute = defaultPath
    }
    if (absolute) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sa = require(absolute) as admin.ServiceAccount
      admin.initializeApp({ credential: admin.credential.cert(sa) })
    } else if (serviceAccountJson && serviceAccountJson.startsWith('{')) {
      const sa = JSON.parse(serviceAccountJson) as admin.ServiceAccount
      admin.initializeApp({ credential: admin.credential.cert(sa) })
    } else {
      admin.initializeApp()
    }
    ready = true
    console.log('[firebase-admin] Initialised')
  } catch (err) {
    console.warn('[firebase-admin] Init failed (auth will be unavailable):', err instanceof Error ? err.message : err)
    ready = false
  }
}

export { admin }
