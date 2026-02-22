/**
 * Server-side user metadata fetch for personalization (video, etc.).
 * Uses firebase-admin Firestore.
 */
import { admin } from '../firebaseAdmin'
import type { PreferenceScores } from '../../shared/preferenceScoresSchema'
import { preferenceScoresToSummary, preferenceScoresToContentGuidance } from '../../shared/preferenceScoresSchema'
import { DEFAULT_ELO } from '../../shared/metadataSchema'

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

function arr(data: unknown, key: string): string[] {
  if (!data || typeof data !== 'object') return []
  const val = (data as Record<string, unknown>)[key]
  return Array.isArray(val) ? val.filter((x): x is string => typeof x === 'string') : []
}

function obj(data: unknown, key: string, fallback: Record<string, number>): Record<string, number> {
  if (!data || typeof data !== 'object') return fallback
  const val = (data as Record<string, unknown>)[key]
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (typeof v === 'number') out[k] = v
    }
    return Object.keys(out).length ? out : fallback
  }
  return fallback
}

function num(data: unknown, key: string, fallback: number): number {
  if (!data || typeof data !== 'object') return fallback
  const v = (data as Record<string, unknown>)[key]
  return typeof v === 'number' ? v : fallback
}

/** Build user context string for AI personalization. */
export function buildUserContextString(data: Record<string, unknown>): string {
  const parts: string[] = []
  if (data.name && typeof data.name === 'string') parts.push(`Student name: ${data.name}.`)
  if (data.university && typeof data.university === 'string') parts.push(`University: ${data.university}.`)
  if (data.studyLevel && typeof data.studyLevel === 'string') parts.push(`Study level: ${data.studyLevel}.`)
  const academicLevel = num(data, 'academicLevel', 0)
  if (academicLevel > 0) parts.push(`Academic level (0–100): ${academicLevel}.`)
  const courses = arr(data, 'courses')
  if (courses.length) parts.push(`Courses: ${courses.join(', ')}.`)
  const mathTopics = arr(data, 'mathTopics')
  if (mathTopics.length) parts.push(`Math topics of interest: ${mathTopics.join(', ')}.`)
  const topicElo = obj(data, 'topicElo', {})
  const eloEntries = Object.entries(topicElo).filter(([, v]) => v !== DEFAULT_ELO)
  if (eloEntries.length) parts.push(`Skill levels (ELO): ${eloEntries.map(([t, e]) => `${t}=${e}`).join(', ')}.`)
  const learningStyle = data.learningStyle as string | undefined
  if (learningStyle && learningStyle !== 'unsure') parts.push(`Learning style: ${learningStyle}.`)
  const tonePreference = data.tonePreference as string | undefined
  if (tonePreference && tonePreference !== 'unsure') parts.push(`Tone preference: ${tonePreference.replace(/_/g, ' ')}.`)
  const contentEngagement = data.contentEngagement as string | undefined
  if (contentEngagement && contentEngagement !== 'unsure') parts.push(`Engages best with: ${contentEngagement.replace(/_/g, ' ')}.`)
  const preferenceScores = parsePreferenceScores(data.preferenceScores)
  if (preferenceScores) {
    const summary = preferenceScoresToSummary(preferenceScores)
    if (summary) parts.push(`Preference scores: ${summary}.`)
    const contentGuidance = preferenceScoresToContentGuidance(preferenceScores)
    if (contentGuidance) parts.push(`Content guidance: ${contentGuidance}.`)
  }
  const learningDisabilities = arr(data, 'learningDisabilities')
  if (learningDisabilities.length) parts.push(`Learning considerations: ${learningDisabilities.join(', ')}.`)
  const weaknesses = arr(data, 'weaknesses')
  if (weaknesses.length) parts.push(`Known weaknesses: ${weaknesses.join(', ')}.`)
  const topicsCovered = arr(data, 'topicsCovered')
  if (topicsCovered.length) parts.push(`Topics covered recently: ${topicsCovered.slice(-10).join(', ')}.`)
  const solveSummaries = arr(data, 'solveSummaries')
  if (solveSummaries.length) parts.push(`Recent problem summaries: ${solveSummaries.slice(-3).join(' | ')}.`)
  const recentInputs = data.recentInputs
  if (Array.isArray(recentInputs) && recentInputs.length) {
    const recent = recentInputs.slice(-5).map((r: { type?: string; content?: string }) =>
      `${r?.type ?? 'activity'}: ${String(r?.content ?? '').slice(0, 80)}`
    )
    parts.push(`Recent activity: ${recent.join('; ')}.`)
  }
  const videoRequests = data.videoRequests
  if (Array.isArray(videoRequests) && videoRequests.length) {
    parts.push(`Recent video topics: ${videoRequests.slice(-5).join(', ')}.`)
  }
  return parts.join(' ')
}

/** Fetch user metadata context string for AI personalization. Returns empty string if not found. */
export async function getUserContextForVideo(uid: string): Promise<string> {
  try {
    const db = admin.firestore()
    const doc = await db.collection('users').doc(uid).get()
    if (!doc.exists) return ''
    const data = doc.data() as Record<string, unknown>
    return buildUserContextString(data)
  } catch (err) {
    console.error('[metadataServer] getUserContextForVideo error:', err)
    return ''
  }
}
