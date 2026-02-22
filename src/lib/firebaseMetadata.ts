import { doc, getDoc, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import type { UserMetadata, Profile, AgentMemory, User } from '../../shared/types'
import type { PreferenceScores } from '../../shared/preferenceScoresSchema'
import { getDefaultPreferenceScores, preferenceScoresToSummary, preferenceScoresToContentGuidance } from '../../shared/preferenceScoresSchema'
import { DEFAULT_ELO, ELO_K_FACTOR, MATH_TOPICS } from '../../shared/metadataSchema'
import { computeAcademicLevel } from '../../shared/academicLevel'
import { db } from './firebase'

/**
 * User metadata is the app's source of truth: create on sign-up, update on every
 * meaningful interaction (onboarding, solves, feedback). All agents read from here.
 */
const METADATA_COLLECTION = 'users'

/** Firestore does not allow undefined; omit those keys. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

function defaultTopicElo(): Record<string, number> {
  return Object.fromEntries(MATH_TOPICS.map((t) => [t, DEFAULT_ELO]))
}

function getDefaultMetadata(email: string, name?: string): UserMetadata {
  const now = Date.now()
  return {
    email,
    name: name ?? undefined,
    createdAt: now,
    updatedAt: now,
    onboardingComplete: false,
    onboardingStep: 0,
    university: undefined,
    studyLevel: undefined,
    courses: [],
    mathTopics: [],
    topicElo: defaultTopicElo(),
    learningPrefs: {},
    topicsCovered: [],
    weaknesses: [],
    solveSummaries: [],
    lastUpdated: now,
    learningDisabilities: [],
    preferenceScores: getDefaultPreferenceScores(),
    totalSolves: 0,
    lastActiveAt: now,
    sessionCount: 0,
  }
}

function parsePreferenceScores(data: unknown): PreferenceScores | undefined {
  if (!data || typeof data !== 'object') return undefined
  const out: Record<string, Record<string, number>> = {}
  for (const [cat, val] of Object.entries(data as Record<string, unknown>)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const opts: Record<string, number> = {}
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (typeof v === 'number' && v >= 1 && v <= 5) opts[k] = v
      }
      if (Object.keys(opts).length) out[cat] = opts
    }
  }
  return Object.keys(out).length ? (out as PreferenceScores) : undefined
}

function parseRecentInputs(data: unknown): UserMetadata['recentInputs'] {
  if (!Array.isArray(data)) return []
  return data
    .filter((x): x is { type?: string; content?: string; timestamp?: number } => x !== null && typeof x === 'object')
    .map((x) => ({
      type: (x.type === 'whiteboard' || x.type === 'chat' || x.type === 'video' ? x.type : 'whiteboard') as 'whiteboard' | 'chat' | 'video',
      content: String(x.content ?? '').slice(0, 500),
      timestamp: typeof x.timestamp === 'number' ? x.timestamp : Date.now(),
    }))
    .filter((x) => x.content)
    .slice(-50)
}

function parseVideoRequests(data: unknown): string[] {
  if (!Array.isArray(data)) return []
  return data.filter((x): x is string => typeof x === 'string').map((s) => s.slice(0, 300)).slice(-20)
}

function parseVideoGenerations(data: unknown): UserMetadata['videoGenerations'] {
  if (!Array.isArray(data)) return []
  return data
    .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
    .map((x) => ({
      question: String(x.question ?? '').slice(0, 500),
      timestamp: typeof x.timestamp === 'number' ? x.timestamp : Date.now(),
      script: typeof x.script === 'string' ? x.script.slice(0, 2000) : undefined,
    }))
    .filter((x) => x.question)
    .slice(-20)
}

function docToMetadata(data: Record<string, unknown>): UserMetadata {
  const arr = (key: string) => (Array.isArray(data[key]) ? (data[key] as string[]) : [])
  const num = (key: string, fallback: number) => (typeof data[key] === 'number' ? (data[key] as number) : fallback)
  const obj = (key: string, fallback: Record<string, number>) =>
    data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])
      ? (data[key] as Record<string, number>)
      : fallback
  return {
    email: (data.email as string) ?? '',
    name: data.name as string | undefined,
    createdAt: num('createdAt', 0),
    updatedAt: num('updatedAt', 0),
    onboardingComplete: (data.onboardingComplete as boolean) ?? false,
    onboardingStep: num('onboardingStep', 0),
    university: data.university as string | undefined,
    studyLevel: data.studyLevel as string | undefined,
    courses: arr('courses'),
    mathTopics: arr('mathTopics'),
    topicElo: obj('topicElo', {}),
    academicLevel: typeof data.academicLevel === 'number' ? data.academicLevel : undefined,
    academicLevelBreakdown: data.academicLevelBreakdown && typeof data.academicLevelBreakdown === 'object'
      ? data.academicLevelBreakdown as UserMetadata['academicLevelBreakdown']
      : undefined,
    learningStyle: data.learningStyle as UserMetadata['learningStyle'],
    tonePreference: data.tonePreference as UserMetadata['tonePreference'],
    environmentPreference: data.environmentPreference as UserMetadata['environmentPreference'],
    contentEngagement: data.contentEngagement as UserMetadata['contentEngagement'],
    learningPrefs: (data.learningPrefs as Record<string, boolean>) ?? {},
    learningDisabilities: arr('learningDisabilities'),
    preferenceScores: parsePreferenceScores(data.preferenceScores),
    procrastinationLevel: data.procrastinationLevel as UserMetadata['procrastinationLevel'],
    otherNeeds: data.otherNeeds as string | undefined,
    topicsCovered: arr('topicsCovered'),
    weaknesses: arr('weaknesses'),
    solveSummaries: arr('solveSummaries'),
    lastUpdated: num('lastUpdated', 0),
    totalSolves: num('totalSolves', 0),
    lastActiveAt: num('lastActiveAt', 0),
    sessionCount: num('sessionCount', 0),
    recentInputs: parseRecentInputs(data.recentInputs),
    videoRequests: parseVideoRequests(data.videoRequests),
    videoGenerations: parseVideoGenerations(data.videoGenerations),
  }
}

/** Get full user metadata. Used by every agent. */
export async function getUserMetadata(uid: string, firestore?: Firestore): Promise<UserMetadata | null> {
  const d = firestore ?? db
  const ref = doc(d, METADATA_COLLECTION, uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return docToMetadata(snap.data() as Record<string, unknown>)
}

/** Create initial user metadata (call after Firebase Auth sign-up). */
export async function createUserMetadata(
  uid: string,
  email: string,
  name?: string,
  firestore?: Firestore
): Promise<UserMetadata> {
  const d = firestore ?? db
  const ref = doc(d, METADATA_COLLECTION, uid)
  const meta = getDefaultMetadata(email, name)
  await setDoc(ref, stripUndefined(meta as Record<string, unknown>))
  return meta
}

/** Partial update of any metadata fields. Call on every meaningful interaction. */
export async function updateMetadataPartial(
  uid: string,
  partial: Partial<Omit<UserMetadata, 'email' | 'createdAt'>>,
  options?: { touchLastActive?: boolean },
  firestore?: Firestore
): Promise<void> {
  const d = firestore ?? db
  const ref = doc(d, METADATA_COLLECTION, uid)
  const now = Date.now()
  const updates: Record<string, unknown> = {
    ...partial,
    updatedAt: now,
  }
  if (options?.touchLastActive !== false) {
    updates.lastActiveAt = now
  }
  await updateDoc(ref, stripUndefined(updates))
}

/** Update profile / onboarding fields and optionally set onboarding complete. Recomputes academic level from study level, courses, university, math topics. */
export async function updateProfileInFirestore(
  uid: string,
  data: {
    university?: string
    studyLevel?: string
    courses?: string[]
    mathTopics?: string[]
    learningPrefs?: Record<string, boolean>
    learningStyle?: UserMetadata['learningStyle']
    tonePreference?: UserMetadata['tonePreference']
    environmentPreference?: UserMetadata['environmentPreference']
    contentEngagement?: UserMetadata['contentEngagement']
    learningDisabilities?: string[]
    procrastinationLevel?: UserMetadata['procrastinationLevel']
    otherNeeds?: string
    onboardingComplete?: boolean
    onboardingStep?: number
  },
  firestore?: Firestore
): Promise<void> {
  const d = firestore ?? db
  const ref = doc(d, METADATA_COLLECTION, uid)
  const snap = await getDoc(ref)
  const existing = snap.exists() ? (snap.data() as Record<string, unknown>) : {}
  const merged = {
    university: data.university ?? existing.university,
    studyLevel: data.studyLevel ?? existing.studyLevel,
    courses: data.courses ?? existing.courses ?? [],
    mathTopics: data.mathTopics ?? existing.mathTopics ?? [],
  }
  const { academicLevel, academicLevelBreakdown } = computeAcademicLevel(merged)
  const updates: Partial<UserMetadata> = {
    ...data,
    academicLevel,
    academicLevelBreakdown,
  }
  await updateMetadataPartial(uid, updates, { touchLastActive: false }, firestore)
}

/** Update agent memory (topics, weaknesses, summaries). */
export async function updateMemoryInFirestore(
  uid: string,
  data: {
    topicsCovered?: string[]
    weaknesses?: string[]
    solveSummaries?: string[]
  },
  firestore?: Firestore
): Promise<void> {
  const d = firestore ?? db
  const ref = doc(d, METADATA_COLLECTION, uid)
  await updateDoc(ref, stripUndefined({ ...data, lastUpdated: Date.now() } as Record<string, unknown>))
}

/** ELO update for one topic after a solve. problemElo = difficulty (default 1200). */
export function computeNewElo(
  currentElo: number,
  isCorrect: boolean,
  problemElo: number = DEFAULT_ELO
): number {
  const expected = 1 / (1 + Math.pow(10, (problemElo - currentElo) / 400))
  const actual = isCorrect ? 1 : 0
  const newElo = Math.round(currentElo + ELO_K_FACTOR * (actual - expected))
  return Math.max(100, Math.min(2500, newElo))
}

/** Update topic ELO in Firestore after a solve. */
export async function updateTopicElo(
  uid: string,
  topic: string,
  isCorrect: boolean,
  problemElo: number = DEFAULT_ELO,
  firestore?: Firestore
): Promise<void> {
  const meta = await getUserMetadata(uid, firestore)
  if (!meta) return
  const current = meta.topicElo[topic] ?? DEFAULT_ELO
  const newElo = computeNewElo(current, isCorrect, problemElo)
  const topicElo = { ...meta.topicElo, [topic]: newElo }
  await updateMetadataPartial(uid, { topicElo }, undefined, firestore)
}

/** Increment solve count and touch lastActiveAt. Call when user completes or starts a solve. */
export async function incrementSolveCount(uid: string, firestore?: Firestore): Promise<void> {
  const meta = await getUserMetadata(uid, firestore)
  if (!meta) return
  await updateMetadataPartial(uid, { totalSolves: meta.totalSolves + 1 }, undefined, firestore)
}

/** Build a string summary of user metadata for AI context (personalization). */
export function metadataToAgentContextString(meta: UserMetadata): string {
  const parts: string[] = []
  if (meta.name) parts.push(`Student name: ${meta.name}.`)
  if (meta.university) parts.push(`University: ${meta.university}.`)
  if (meta.studyLevel) parts.push(`Study level: ${meta.studyLevel}.`)
  if (typeof meta.academicLevel === 'number') {
    parts.push(`Academic level (0–100, from study level/courses/institution/topic depth): ${meta.academicLevel}.`)
    if (meta.academicLevelBreakdown) {
      const b = meta.academicLevelBreakdown
      parts.push(`Breakdown: studyLevel=${b.studyLevel}, courseLoad=${b.courseLoad}, institution=${b.institution}, topicDepth=${b.topicDepth}.`)
    }
  }
  if (meta.courses?.length) parts.push(`Courses: ${meta.courses.join(', ')}.`)
  if (meta.mathTopics?.length) parts.push(`Math topics of interest: ${meta.mathTopics.join(', ')}.`)
  const eloEntries = Object.entries(meta.topicElo).filter(([, v]) => v !== DEFAULT_ELO)
  if (eloEntries.length)
    parts.push(
      `Skill levels (ELO): ${eloEntries.map(([t, e]) => `${t}=${e}`).join(', ')}.`
    )
  if (meta.learningStyle && meta.learningStyle !== 'unsure')
    parts.push(`Learning style: ${meta.learningStyle}.`)
  if (meta.tonePreference && meta.tonePreference !== 'unsure')
    parts.push(`Tone preference: ${meta.tonePreference.replace('_', ' ')}.`)
  if (meta.contentEngagement && meta.contentEngagement !== 'unsure')
    parts.push(`Engages best with: ${meta.contentEngagement.replace('_', ' ')}.`)
  if (meta.preferenceScores) {
    const summary = preferenceScoresToSummary(meta.preferenceScores)
    if (summary) parts.push(`Preference scores (1-5 ratings, use for decisions): ${summary}.`)
    const contentGuidance = preferenceScoresToContentGuidance(meta.preferenceScores)
    if (contentGuidance) parts.push(`Content guidance (length, engagement, math format, goal, approach): ${contentGuidance}.`)
  }
  if (meta.learningDisabilities?.length)
    parts.push(`Learning considerations: ${meta.learningDisabilities.join(', ')}.`)
  if (meta.procrastinationLevel)
    parts.push(`Procrastination level (1-5): ${meta.procrastinationLevel}.`)
  if (meta.weaknesses?.length) parts.push(`Known weaknesses: ${meta.weaknesses.join(', ')}.`)
  if (meta.topicsCovered?.length)
    parts.push(`Topics covered recently: ${meta.topicsCovered.slice(-10).join(', ')}.`)
  if (meta.solveSummaries?.length) {
    const recent = meta.solveSummaries.slice(-3)
    parts.push(`Recent problem summaries: ${recent.join(' | ')}.`)
  }
  if (meta.recentInputs?.length) {
    const recent = meta.recentInputs.slice(-5).map((r) => `${r.type}: ${r.content.slice(0, 80)}`)
    parts.push(`Recent activity: ${recent.join('; ')}.`)
  }
  if (meta.videoRequests?.length) {
    parts.push(`Recent video topics: ${meta.videoRequests.slice(-5).join(', ')}.`)
  }
  return parts.join(' ')
}

/** Record user input for personalization. Call on every meaningful user action. */
export async function recordUserInput(
  uid: string,
  type: 'whiteboard' | 'chat' | 'video',
  content: string,
  firestore?: Firestore
): Promise<void> {
  const d = firestore ?? db
  const ref = doc(d, METADATA_COLLECTION, uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data() as Record<string, unknown>
  const existing = parseRecentInputs(data.recentInputs) ?? []
  const entry = { type, content: content.slice(0, 500), timestamp: Date.now() }
  const recentInputs = [...existing, entry].slice(-50)
  const updates: Record<string, unknown> = { recentInputs, updatedAt: Date.now(), lastActiveAt: Date.now() }
  if (type === 'video') {
    const videoRequests = parseVideoRequests(data.videoRequests) ?? []
    updates.videoRequests = [...videoRequests, content.slice(0, 300)].slice(-20)
  }
  await updateDoc(ref, stripUndefined(updates))
}

/** Save a video generation (question + optional script) for dashboard display. */
export async function saveVideoGeneration(
  uid: string,
  question: string,
  script?: string,
  firestore?: Firestore
): Promise<void> {
  const d = firestore ?? db
  const ref = doc(d, METADATA_COLLECTION, uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data() as Record<string, unknown>
  const existing = parseVideoGenerations(data.videoGenerations) ?? []
  const entry = {
    question: question.slice(0, 500),
    timestamp: Date.now(),
    script: script ? script.slice(0, 2000) : undefined,
  }
  const videoGenerations = [...existing, entry].slice(-20)
  await updateDoc(ref, stripUndefined({ videoGenerations, updatedAt: Date.now(), lastActiveAt: Date.now() }))
}

/** Update topic ELO after a video request (infer topic from question). Used for video difficulty. */
export async function updateVideoTopicElo(
  uid: string,
  question: string,
  firestore?: Firestore
): Promise<void> {
  const meta = await getUserMetadata(uid, firestore)
  if (!meta) return
  const topic = inferTopicFromQuestion(question)
  const current = meta.topicElo[topic] ?? DEFAULT_ELO
  const newElo = Math.round(current + ELO_K_FACTOR * 0.1)
  const topicElo = { ...meta.topicElo, [topic]: Math.min(2500, newElo) }
  await updateMetadataPartial(uid, { topicElo }, { touchLastActive: true }, firestore)
}

function inferTopicFromQuestion(q: string): string {
  const lower = q.toLowerCase()
  const topics = ['algebra', 'linear_algebra', 'calculus', 'geometry', 'probability', 'statistics', 'differential_equations', 'number_theory', 'discrete_math', 'optimization', 'complex_analysis', 'abstract_algebra', 'real_analysis', 'topology']
  for (const t of topics) {
    if (lower.includes(t.replace('_', ' ')) || lower.includes(t)) return t
  }
  return 'general'
}

export function metadataToUser(uid: string, meta: UserMetadata): User {
  return {
    id: uid,
    email: meta.email,
    name: meta.name,
    createdAt: meta.createdAt,
  }
}

export function metadataToProfile(uid: string, meta: UserMetadata): Profile {
  return {
    userId: uid,
    university: meta.university,
    studyLevel: meta.studyLevel,
    courses: meta.courses,
    learningPrefs: meta.learningPrefs,
    onboardingComplete: meta.onboardingComplete,
    updatedAt: meta.updatedAt,
  }
}

export function metadataToAgentMemory(uid: string, meta: UserMetadata): AgentMemory {
  return {
    userId: uid,
    topicsCovered: meta.topicsCovered,
    weaknesses: meta.weaknesses,
    solveSummaries: meta.solveSummaries,
    lastUpdated: meta.lastUpdated,
  }
}
