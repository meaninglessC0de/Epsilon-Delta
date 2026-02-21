import Anthropic from '@anthropic-ai/sdk'
import type { UserMetadata, Solve } from '../../shared/types'
import { metadataToAgentContextString } from './firebaseMetadata'

function getClient() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set in your .env file')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

/** Normalized 0–1 box on the image where the error is (for overlay highlight) */
export interface HighlightRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface CheckResult {
  feedback: string
  isCorrect: boolean
  hints: string[]
  encouragement: string
  /** When wrong: one short sentence for TTS (ElevenLabs) */
  speakSummary?: string
  /** When wrong: approximate region of the error (0–1) for whiteboard highlight */
  highlightRegion?: HighlightRegion
}

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === 'text')
  return block?.type === 'text' ? block.text : ''
}

function parseCheckResult(raw: string): CheckResult {
  const fallback: CheckResult = { feedback: 'Looking good — keep going!', isCorrect: false, hints: [], encouragement: 'Keep it up!' }
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

  // Strip markdown code fences that Claude sometimes wraps JSON in
  const text = raw.replace(/^```[\w]*\s*/m, '').replace(/```\s*$/m, '').trim()

  // Attempt 1: the whole cleaned string is valid JSON
  try {
    const parsed = JSON.parse(text) as CheckResult
    if (parsed.highlightRegion) {
      const r = parsed.highlightRegion
      parsed.highlightRegion = { x: clamp01(r.x), y: clamp01(r.y), width: clamp01(r.width), height: clamp01(r.height) }
    }
    return parsed
  } catch { /* continue */ }

  // Attempt 2: extract the first {...} block (handles trailing prose)
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as CheckResult
      if (parsed.highlightRegion) {
        const r = parsed.highlightRegion
        parsed.highlightRegion = { x: clamp01(r.x), y: clamp01(r.y), width: clamp01(r.width), height: clamp01(r.height) }
      }
      return parsed
    } catch { /* continue */ }
  }

  console.warn('[claude] Could not parse feedback JSON. Raw response:', raw)
  return fallback
}

// Periodic check — short and fast, no extended thinking
export async function checkWorking(
  problem: string,
  workingBase64: string,
  previousFeedback?: string,
  userContext?: string,
): Promise<CheckResult> {
  const client = getClient()

  const personalisation = userContext
    ? `\nStudent context (use to tailor tone and depth): ${userContext}`
    : ''

  // Giving Claude an exact example is the most reliable way to get back pure JSON.
  const prompt = `You are a maths tutor reviewing a student's handwritten work.
Problem: "${problem}"${previousFeedback ? `\nPrevious feedback: "${previousFeedback}"` : ''}${personalisation}

Look at the image and reply with ONLY a raw JSON object — no markdown, no code fences, no explanation. Use exactly this shape (all keys required; speakSummary and highlightRegion only when isCorrect is false):
{"feedback":"1-2 specific sentences about what is correct and where any error is.","isCorrect":false,"hints":["one concrete next step if wrong, else leave array empty"],"encouragement":"Short upbeat phrase.","speakSummary":"When wrong only: one short sentence for voice, e.g. 'Check the sign on the second term.'","highlightRegion":{"x":0.1,"y":0.2,"width":0.4,"height":0.25}}

highlightRegion: when isCorrect is false, give approximate region of the error as fractions of image size (0-1). x,y = top-left; width,height = size. If unsure use e.g. {"x":0,"y":0.3,"width":0.5,"height":0.3}. Omit highlightRegion entirely if isCorrect is true.

CRITICAL RULES — failure to follow these will break the app:
1. Return ONLY the raw JSON object. No extra text, no code fences, no markdown.
2. Write ALL mathematics in plain English words only. Never use symbols like +, -, =, ×, ÷, ^, ², √, π, <, >, or any LaTeX. Write "x squared plus three equals seven" not "x² + 3 = 7".`

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: workingBase64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  return parseCheckResult(extractText(response))
}

// After a solve completes, update the agent memory with new topics/weaknesses/summary. Returns primaryTopic for ELO.
export async function refreshMemory(
  current: { topicsCovered: string[]; weaknesses: string[]; solveSummaries: string[] },
  solve: { problem: string; finalFeedback: string; hints: string[] },
  userContext?: string,
): Promise<{ topicsCovered: string[]; weaknesses: string[]; solveSummaries: string[]; primaryTopic?: string }> {
  const client = getClient()

  const personalisation = userContext ? `\nStudent context: ${userContext}` : ''

  const prompt = `You are an AI analysing a student's maths work to update their learning profile.

Problem: "${solve.problem}"
Final feedback: "${solve.finalFeedback}"
${solve.hints.length ? `Hints given during the session: ${solve.hints.slice(0, 5).join('; ')}` : ''}

Current topics covered: ${JSON.stringify(current.topicsCovered)}
Current weaknesses: ${JSON.stringify(current.weaknesses)}${personalisation}

Produce a raw JSON object (no markdown, no code fences) with exactly these keys:
{
  "topicsCovered": [...],
  "weaknesses": [...],
  "solveSummary": "...",
  "primaryTopic": "one of: algebra, linear_algebra, calculus, real_analysis, geometry, topology, probability, statistics, differential_equations, number_theory, discrete_math, optimization, complex_analysis, abstract_algebra, or general"
}

Rules:
- "topicsCovered": merge the existing list with 1–2 new topic tags for this problem. No duplicates. Max 20 total.
- "weaknesses": update the existing list — add newly observed weaknesses, remove any that seem resolved. Keep to the 5 most relevant.
- "solveSummary": one sentence describing the problem and how the student did. Plain English, no symbols.
- "primaryTopic": the single best matching standardized topic for this problem (use snake_case).`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = extractText(response)
  const text = raw.replace(/^```[\w]*\s*/m, '').replace(/```\s*$/m, '').trim()

  try {
    const parsed = JSON.parse(text) as {
      topicsCovered: string[]
      weaknesses: string[]
      solveSummary: string
      primaryTopic?: string
    }
    const summaries = [...current.solveSummaries, parsed.solveSummary].slice(-20)
    return {
      topicsCovered: parsed.topicsCovered ?? current.topicsCovered,
      weaknesses: parsed.weaknesses ?? current.weaknesses,
      solveSummaries: summaries,
      primaryTopic: parsed.primaryTopic ?? 'general',
    }
  } catch {
    console.warn('[claude] refreshMemory parse failed, returning current memory')
    return { ...current, primaryTopic: 'general' }
  }
}

// Voice tutor — fast conversational AI
export interface TutorMessage { role: 'user' | 'assistant'; content: string }

/**
 * Build a concise, image-free summary of the student's solve history.
 * Solves are expected newest-first (as returned by Firestore).
 * Base64 fields (problemImage, finalWorking, FeedbackEntry.snapshot) are intentionally excluded.
 */
function buildSolveSummary(solves: Solve[]): string {
  if (!solves.length) return ''
  const recent = solves.slice(0, 10)
  const lines = recent.map((s) => {
    const problem = s.problem.length > 80 ? s.problem.slice(0, 80) + '…' : s.problem
    const checks = s.feedbackHistory.length
    const hintCount = s.feedbackHistory.flatMap((f) => f.hints).length
    const incorrectChecks = s.feedbackHistory.filter((f) => !f.isCorrect).length

    let outcome: string
    if (s.status === 'completed') {
      outcome = 'completed'
      if (s.finalFeedback) {
        const fb = s.finalFeedback.length > 60 ? s.finalFeedback.slice(0, 60) + '…' : s.finalFeedback
        outcome += ` — final feedback: "${fb}"`
      }
    } else {
      outcome = `in progress, ${checks} check${checks !== 1 ? 's' : ''}`
    }

    const extras: string[] = []
    if (hintCount > 0) extras.push(`${hintCount} hint${hintCount !== 1 ? 's' : ''} used`)
    if (incorrectChecks > 0) extras.push(`${incorrectChecks} incorrect attempt${incorrectChecks !== 1 ? 's' : ''}`)

    return `- "${problem}" — ${outcome}${extras.length ? ` (${extras.join(', ')})` : ''}`
  })
  return `Problems worked on (most recent first):\n${lines.join('\n')}`
}

/**
 * Voice tutor chat. Receives the full UserMetadata so every personalisation field is
 * automatically available — including any fields added in the future.
 */
export async function chatWithTutor(
  messages: TutorMessage[],
  context: {
    /** Full Firestore user metadata. All fields (ELO, preferences, weaknesses, etc.) are used. */
    meta: UserMetadata | null
    /** Full Solve objects from Firestore — base64 image fields are stripped internally. */
    solves: Solve[]
  }
): Promise<string> {
  const client = getClient()

  const metaSection = context.meta ? metadataToAgentContextString(context.meta) : ''
  const solvesSection = buildSolveSummary(context.solves)
  const studentName = context.meta?.name

  const systemPrompt = `You are Epsilon-Delta, a warm and encouraging maths tutor having a voice conversation with a student.${studentName ? ` The student's name is ${studentName}.` : ''}
${metaSection ? `\nStudent profile: ${metaSection}` : ''}${solvesSection ? `\n\n${solvesSection}` : ''}

CRITICAL RULES for voice output:
1. Respond in plain English only — no symbols, no LaTeX, no bullet points, no markdown.
2. Write all mathematics in words: "x squared plus three" not "x² + 3".
3. Keep every response to 1 or 2 short sentences, under 35 words total. This is a voice call so brevity is essential.
4. Be warm, encouraging, and conversational. Address the student by name if you know it.
5. Never use asterisks, dashes as bullets, hash symbols, or any special characters.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  const block = response.content.find((b) => b.type === 'text')
  return block?.type === 'text' ? block.text : "I'm here to help — what would you like to work on?"
}

// Final feedback — slightly more detail, still concise
export async function getFinalFeedback(
  problem: string,
  finalWorkingBase64: string,
  userContext?: string,
): Promise<string> {
  const client = getClient()

  const personalisation = userContext ? ` Student context: ${userContext}` : ''
  const text = `Maths tutor. Problem: "${problem}". Give a final verdict in 2 sentences: did they get it right, and one piece of encouragement. Write everything in plain English words only — no mathematical symbols, no LaTeX, no notation of any kind.${personalisation}`

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: finalWorkingBase64 } },
          { type: 'text', text },
        ],
      },
    ],
  })

  return extractText(response) || 'Well done — session saved.'
}
