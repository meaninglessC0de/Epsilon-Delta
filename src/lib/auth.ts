import {
  registerWithFirebase,
  loginWithFirebase,
  signInWithGoogleFirebase,
  logoutFirebase,
  getMeFromFirebase,
  subscribeToAuth,
  migratePendingMetadataIfAny,
} from './firebaseAuth'
import { auth } from './firebase'
import type { AuthResponse, MeResponse, UserMetadata } from '../../shared/types'

const TOKEN_KEY = 'auth_token'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

async function storeToken(token: string): Promise<void> {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export async function register(email: string, password: string, name?: string): Promise<AuthResponse> {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }
  try {
    let data = await registerWithFirebase(email, password, name)
    await storeToken(data.token)
    await migratePendingMetadataIfAny(auth.currentUser!.uid, data.user.email)
    const { getUserMetadata, metadataToUser } = await import('./firebaseMetadata')
    const meta = await getUserMetadata(auth.currentUser!.uid)
    if (meta) data = { token: data.token, user: metadataToUser(auth.currentUser!.uid, meta), onboardingComplete: meta.onboardingComplete }
    return data
  } catch (err) {
    const { toFriendlyAuthError } = await import('./firebaseAuth')
    throw new Error(toFriendlyAuthError(err))
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    let data = await loginWithFirebase(email, password)
    await storeToken(data.token)
    await migratePendingMetadataIfAny(auth.currentUser!.uid, data.user.email)
    const { getUserMetadata, metadataToUser } = await import('./firebaseMetadata')
    const meta = await getUserMetadata(auth.currentUser!.uid)
    if (meta) data = { token: data.token, user: metadataToUser(auth.currentUser!.uid, meta), onboardingComplete: meta.onboardingComplete }
    return data
  } catch (err) {
    const { toFriendlyAuthError } = await import('./firebaseAuth')
    throw new Error(toFriendlyAuthError(err))
  }
}

export function logout(): void {
  clearToken()
  logoutFirebase()
}

export async function getMe(): Promise<MeResponse> {
  return getMeFromFirebase()
}

/** Sign in or sign up with Google. */
export async function loginWithGoogle(): Promise<AuthResponse> {
  try {
    let data = await signInWithGoogleFirebase()
    await storeToken(data.token)
    await migratePendingMetadataIfAny(auth.currentUser!.uid, data.user.email)
    const { getUserMetadata, metadataToUser } = await import('./firebaseMetadata')
    const meta = await getUserMetadata(auth.currentUser!.uid)
    if (meta) data = { token: data.token, user: metadataToUser(auth.currentUser!.uid, meta), onboardingComplete: meta.onboardingComplete }
    return data
  } catch (err) {
    const { toFriendlyAuthError } = await import('./firebaseAuth')
    throw new Error(toFriendlyAuthError(err))
  }
}

export { subscribeToAuth }

export async function updateProfile(data: {
  university?: string
  studyLevel?: string
  courses?: string[]
  mathTopics?: string[]
  learningPrefs?: Record<string, boolean>
  learningStyle?: 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'mixed' | 'unsure'
  tonePreference?: 'funny_light' | 'balanced' | 'serious_technical' | 'unsure'
  environmentPreference?: 'quiet' | 'background_noise' | 'group' | 'unsure'
  contentEngagement?: 'short_bites' | 'deep_dives' | 'examples_first' | 'theory_first' | 'unsure'
  learningDisabilities?: string[]
  procrastinationLevel?: 1 | 2 | 3 | 4 | 5
  otherNeeds?: string
  onboardingComplete?: boolean
  onboardingStep?: number
}): Promise<void> {
  const { updateProfileInFirestore } = await import('./firebaseMetadata')
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  await updateProfileInFirestore(uid, data)
}

/** Partial metadata update (onboarding step data, interaction touch). */
export async function updateMetadata(partial: Partial<Omit<UserMetadata, 'email' | 'createdAt'>>): Promise<void> {
  const { updateMetadataPartial } = await import('./firebaseMetadata')
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  await updateMetadataPartial(uid, partial)
}
