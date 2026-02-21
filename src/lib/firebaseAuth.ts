import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  type Unsubscribe,
} from 'firebase/auth'
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { createUserMetadata, getUserMetadata, metadataToUser } from './firebaseMetadata'
import type { AuthResponse, MeResponse, User } from '../../shared/types'

const MIGRATION_COLLECTION = 'migration_pending'

export function toFriendlyAuthError(err: unknown): string {
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : ''
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
      return 'Firebase Auth is not set up. In Firebase Console open Authentication → Sign-in method and enable "Email/Password".'
    }
    if (code === 'auth/invalid-api-key' || code === 'auth/invalid-credential') {
      return 'Invalid Firebase config. Check your .env (VITE_FIREBASE_*) and restart the dev server.'
    }
  }
  if (msg && (msg.includes('CONFIGURATION_NOT_FOUND') || msg.includes('configuration-not-found'))) {
    return 'Firebase Auth is not set up. In Firebase Console open Authentication → Sign-in method and enable "Email/Password".'
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return 'Sign-in was cancelled.'
    }
    if (code === 'auth/popup-blocked') {
      return 'Sign-in popup was blocked. Allow popups for this site and try again.'
    }
    if (code === 'auth/account-exists-with-different-credential') {
      return 'An account already exists with this email using another sign-in method. Try signing in with email/password.'
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}

/** Sign in or sign up with Google; creates user metadata if new. */
export async function signInWithGoogleFirebase(): Promise<AuthResponse> {
  const provider = new GoogleAuthProvider()
  const cred = await signInWithPopup(auth, provider)
  const uid = cred.user.uid
  let meta = await getUserMetadata(uid)
  if (!meta) {
    meta = await createUserMetadata(uid, cred.user.email!, cred.user.displayName ?? undefined)
  }
  const user: User = metadataToUser(uid, meta)
  return {
    token: await cred.user.getIdToken(),
    user,
    onboardingComplete: meta.onboardingComplete,
  }
}

/** Register with Firebase Auth and create Firestore user metadata. */
export async function registerWithFirebase(
  email: string,
  password: string,
  name?: string
): Promise<AuthResponse> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
  const uid = cred.user.uid
  let meta = await getUserMetadata(uid)
  if (!meta) {
    meta = await createUserMetadata(uid, cred.user.email!, name ?? cred.user.displayName ?? undefined)
  }
  const user: User = metadataToUser(uid, meta)
  return {
    token: await cred.user.getIdToken(),
    user,
    onboardingComplete: meta.onboardingComplete,
  }
}

/** Login with Firebase Auth and return user + onboarding status from Firestore. */
export async function loginWithFirebase(email: string, password: string): Promise<AuthResponse> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
  const uid = cred.user.uid
  let meta = await getUserMetadata(uid)
  if (!meta) {
    meta = await createUserMetadata(uid, cred.user.email!, cred.user.displayName ?? undefined)
  }
  const user: User = metadataToUser(uid, meta)
  return {
    token: await cred.user.getIdToken(),
    user,
    onboardingComplete: meta.onboardingComplete,
  }
}

export function logoutFirebase(): Promise<void> {
  return signOut(auth)
}

/** Get current user and onboarding status (from Firestore metadata). */
export async function getMeFromFirebase(): Promise<MeResponse> {
  const fb = auth.currentUser
  if (!fb) throw new Error('Not authenticated')
  const meta = await getUserMetadata(fb.uid)
  if (!meta) throw new Error('User metadata not found')
  const user: User = metadataToUser(fb.uid, meta)
  return { user, onboardingComplete: meta.onboardingComplete }
}

const AUTH_METADATA_TIMEOUT_MS = 10_000

/** Subscribe to auth state changes. Returns unsubscribe. Never blocks indefinitely. */
export function subscribeToAuth(callback: (user: User | null, onboardingComplete: boolean) => void): Unsubscribe {
  return onAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      callback(null, false)
      return
    }
    const fallback: User = {
      id: fbUser.uid,
      email: fbUser.email ?? '',
      name: fbUser.displayName ?? undefined,
      createdAt: 0,
    }
    let settled = false
    const done = (user: User, onboardingComplete: boolean) => {
      if (settled) return
      settled = true
      callback(user, onboardingComplete)
    }
    const timeoutId = setTimeout(() => {
      done(fallback, false)
    }, AUTH_METADATA_TIMEOUT_MS)
    ;(async () => {
      try {
        let meta = await getUserMetadata(fbUser.uid)
        if (!meta) {
          meta = await createUserMetadata(fbUser.uid, fbUser.email!, fbUser.displayName ?? undefined)
        }
        clearTimeout(timeoutId)
        done(metadataToUser(fbUser.uid, meta), meta.onboardingComplete)
      } catch {
        clearTimeout(timeoutId)
        done(fallback, false)
      }
    })()
  })
}

/** If migration_pending/{email} exists (from SQLite migration), copy to users/{uid} and delete pending. */
export async function migratePendingMetadataIfAny(uid: string, email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim()
  const ref = doc(db, MIGRATION_COLLECTION, normalizedEmail)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data() as Record<string, unknown>
  const userRef = doc(db, 'users', uid)
  await setDoc(userRef, data)

  const solvesCol = collection(db, MIGRATION_COLLECTION, normalizedEmail, 'solves')
  const solvesSnap = await getDocs(solvesCol)
  const { writeBatch } = await import('firebase/firestore')
  const batch = writeBatch(db)
  for (const d of solvesSnap.docs) {
    batch.set(doc(db, 'users', uid, 'solves', d.id), d.data())
    batch.delete(d.ref)
  }
  await batch.commit()
  await deleteDoc(ref)
}
