import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined
const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined

const config = {
  apiKey: apiKey ?? '',
  authDomain: authDomain ?? '',
  projectId: projectId ?? '',
  storageBucket: storageBucket ?? '',
  messagingSenderId: messagingSenderId ?? '',
  appId: appId ?? '',
}

/** True if all required Firebase client env vars are set (so Auth/Firestore can run). */
export function isFirebaseConfigured(): boolean {
  return !!(apiKey && projectId && authDomain && appId)
}

if (!isFirebaseConfigured()) {
  const msg =
    'Firebase is not configured. Add VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID to .env and restart the dev server (npm run dev).'
  console.error(msg)
  throw new Error(msg)
}

const app = initializeApp(config)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Optional: use emulators in development
const useEmulator = import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true'
if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

export default app
