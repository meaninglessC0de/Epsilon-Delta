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
  problem: string
  problemImage?: string // base64 JPEG (no data: prefix)
  createdAt: number
  completedAt?: number
  finalWorking?: string // base64 JPEG (no data: prefix)
  feedbackHistory: FeedbackEntry[]
  finalFeedback?: string
  status: 'active' | 'completed'
}
