// Types shared between server and client

export interface FeedbackEntry {
  id: string
  timestamp: number
  feedback: string
  snapshot: string // base64 JPEG (no data: prefix)
  isCorrect: boolean
  hints: string[]
  encouragement: string
}

export interface Solve {
  id: string
  userId?: number // optional until Step 1d migrates solves to API
  problem: string
  problemImage?: string // base64 JPEG (no data: prefix)
  createdAt: number
  completedAt?: number
  finalWorking?: string // base64 JPEG (no data: prefix)
  feedbackHistory: FeedbackEntry[]
  finalFeedback?: string
  status: 'active' | 'completed'
}

export interface User {
  id: number
  email: string
  name?: string
  createdAt: number
}

export interface Profile {
  userId: number
  university?: string
  studyLevel?: string
  courses: string[]
  learningPrefs: Record<string, boolean>
  onboardingComplete: boolean
  updatedAt: number
}

export interface AgentMemory {
  userId: number
  topicsCovered: string[]
  weaknesses: string[]
  solveSummaries: string[]
  lastUpdated: number
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
