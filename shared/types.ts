// Types shared between server and client
import type { PreferenceScores } from './preferenceScoresSchema'

/** Normalized 0–1 region on the canvas where the AI detected an error (for highlight overlay) */
export interface HighlightRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface FeedbackEntry {
  id: string
  timestamp: number
  feedback: string
  snapshot: string // base64 JPEG (no data: prefix)
  isCorrect: boolean
  hints: string[]
  encouragement: string
  /** Short phrase for TTS when wrong (ElevenLabs) */
  speakSummary?: string
  /** Where to show error highlight on the whiteboard (0–1 normalized) */
  highlightRegion?: HighlightRegion
}

/** Excalidraw scene for whiteboard restore (elements + appState). Stored in DB so user can resume. */
export interface WhiteboardState {
  elements: unknown[]
  appState: Record<string, unknown>
}

export interface Solve {
  id: string
  userId?: string
  problem: string
  problemImage?: string // base64 JPEG (no data: prefix)
  createdAt: number
  completedAt?: number
  finalWorking?: string // base64 JPEG (no data: prefix)
  feedbackHistory: FeedbackEntry[]
  finalFeedback?: string
  status: 'active' | 'completed' | 'incorrect'
  /** When set, this solve is part of a problem sheet; use with questionIndex/questionCount. */
  groupId?: string
  questionIndex?: number
  questionCount?: number
  /** Optional title for the sheet (e.g. "Week 3 homework"). */
  sheetTitle?: string
  /** Full Excalidraw scene so the whiteboard can be restored when user resumes. */
  whiteboardState?: WhiteboardState
}

export interface User {
  id: string // Firebase Auth uid
  email: string
  name?: string
  createdAt: number
}

export interface Profile {
  userId: string
  university?: string
  studyLevel?: string
  courses: string[]
  learningPrefs: Record<string, boolean>
  onboardingComplete: boolean
  updatedAt: number
}

export interface AgentMemory {
  userId: string
  topicsCovered: string[]
  weaknesses: string[]
  solveSummaries: string[]
  lastUpdated: number
}

/** Single Firestore document for users/{uid}. Used by all agents for personalization. */
export interface UserMetadata {
  email: string
  name?: string
  createdAt: number
  updatedAt: number
  onboardingComplete: boolean
  /** Current onboarding step (0 = welcome, 1 = basics, …). */
  onboardingStep?: number

  // — Academic context —
  university?: string
  studyLevel?: string
  courses: string[]
  /** Math topics the user wants to focus on (from MATH_TOPICS + custom). */
  mathTopics: string[]

  // — ELO per topic (university-level math). Default 1500. —
  topicElo: Record<string, number>

  /** Computed 0–100 academic level from study level, courses, institution, topic depth (rating algorithm). */
  academicLevel?: number
  /** Sub-scores (0–100 each) used to compute academicLevel. */
  academicLevelBreakdown?: {
    studyLevel: number
    courseLoad: number
    institution: number
    topicDepth: number
  }

  // — Learning style (from indirect questions) —
  learningStyle?: 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'mixed' | 'unsure'
  tonePreference?: 'funny_light' | 'balanced' | 'serious_technical' | 'unsure'
  environmentPreference?: 'quiet' | 'background_noise' | 'group' | 'unsure'
  contentEngagement?: 'short_bites' | 'deep_dives' | 'examples_first' | 'theory_first' | 'unsure'

  // — Explicit learning preferences (legacy; prefer preferenceScores for calculations) —
  learningPrefs: Record<string, boolean>

  /** All learning-preference dimensions as 1–5 ratings. Used for preference calculations. */
  preferenceScores?: PreferenceScores

  // — Accessibility & behaviour —
  learningDisabilities: string[]
  procrastinationLevel?: 1 | 2 | 3 | 4 | 5
  otherNeeds?: string

  // — Agent memory (updated on interactions) —
  topicsCovered: string[]
  weaknesses: string[]
  solveSummaries: string[]
  lastUpdated: number

  // — Interaction stats (updated on every interaction) —
  totalSolves: number
  lastActiveAt: number
  sessionCount: number

  // — Recent inputs (updated on every user action: whiteboard, chat, video) —
  recentInputs?: { type: 'whiteboard' | 'chat' | 'video'; content: string; timestamp: number }[]
  videoRequests?: string[]
  /** Recent video generations: question, timestamp, optional script (narration summary) when available */
  videoGenerations?: { question: string; timestamp: number; script?: string }[]
}

// API response shapes
export interface AuthResponse {
  token: string
  user: User
  onboardingComplete: boolean
}

export interface MeResponse {
  user: User
  onboardingComplete: boolean
}
