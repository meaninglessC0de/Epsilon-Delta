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
  /** When true: work is incomplete (not finished). App will not show alert; do not mark complete. */
  isIncomplete?: boolean
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
  problemImageBase64?: string,
): Promise<CheckResult> {
  const client = getClient()

  const personalisation = userContext
    ? `\nStudent context (use to tailor tone and depth): ${userContext}`
    : ''

  const problemImageNote = problemImageBase64
    ? '\nThe first image is the problem itself (for reference). The second image is the student\'s current whiteboard work.'
    : ''

  // Giving Claude an exact example is the most reliable way to get back pure JSON.
  const prompt = `You are a maths tutor reviewing handwritten whiteboard work in real time. Every 20 seconds the current board is sent. Analyze what the student has written — focus on the problem, parse their steps and notation.

Problem: "${problem}"${problemImageNote}${previousFeedback ? `\nPrevious feedback: "${previousFeedback}"` : ''}${personalisation}

PARSING: Read handwritten digits and symbols carefully. Watch for 0 vs O, 1 vs l, 5 vs S, + vs ×. Infer intent from context and layout (left-to-right, top-to-bottom). If the board is mostly blank, doodles, illegible, or unrelated to the problem — treat as incomplete and say nothing.

SILENCE RULE: Only provide feedback (speakSummary) when you have identified a CLEAR, OBJECTIVE mathematical error. If the work is correct so far, incomplete, illegible, or ambiguous — set isIncomplete to true and omit speakSummary. The app will stay silent. Do NOT comment on correct work or uncertain cases.

REQUIRED: Reply with ONLY a raw JSON object — no markdown, no code fences. Use exactly this shape:
{"feedback":"1-2 sentences.","isCorrect":false,"hints":["concrete next step if wrong else empty"],"encouragement":"Short phrase.","speakSummary":"Only when you identified a specific mathematical error.","highlightRegion":{"x":0.1,"y":0.2,"width":0.4,"height":0.25},"isIncomplete":true}

speakSummary: Only when isIncomplete is false (clear math error). Explain the specific mistake in plain words (e.g. "You added instead of subtracting — it should be 5 minus 2, which is 3"). No vague phrases.

CRITICAL — when to set isIncomplete:
- Set isIncomplete to true (say nothing) when: work in progress, blank, illegible, doodles, unexpected input, or you are unsure. Do NOT provide speakSummary.
- Set isIncomplete to false (give feedback) ONLY when you have identified a definite mathematical error: wrong step, wrong arithmetic, wrong sign, wrong formula, wrong answer. Then provide speakSummary.

CRITICAL — isCorrect: true ONLY when the problem is fully solved and completely correct. Otherwise false.

highlightRegion: only when isCorrect is false AND isIncomplete is false. Use small 0-1 fractions. Omit if unsure.

OTHER: Return ONLY the raw JSON. Write all maths in plain English words — no symbols like +, -, =, ×, ÷, ^, ², √, π.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: [
          ...(problemImageBase64 ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: problemImageBase64 } }] : []),
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: workingBase64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  return parseCheckResult(extractText(response))
}

/** One extracted question: text and optional region (0-1) for diagram crop. */
export interface SheetQuestion {
  problem: string
  /** When the question has a diagram, give the region where it appears (0-1 normalized). */
  region?: { x: number; y: number; width: number; height: number }
}

/** Extract questions from a problem sheet image; optionally with regions for diagram crops. */
export async function extractQuestionsFromSheet(sheetImageBase64: string): Promise<SheetQuestion[]> {
  const client = getClient()
  const prompt = `You are looking at an image of a maths problem sheet (homework, worksheet, exam) that contains MULTIPLE distinct questions or problems.

Your task: list each question as an object with "problem" (string) and optionally "region" (for diagram-based questions).

Return ONLY a valid JSON array — no markdown, no code fences. Each item: { "problem": "question text here", "region": { "x": 0.1, "y": 0.2, "width": 0.4, "height": 0.25 } }.
- "problem": full text or clear short description of that question. Use plain English for maths (e.g. "x squared" not "x²").
- "region": only include when the question has a diagram, figure, or graph that should be shown with the question. Give the approximate area as fractions of image size (0-1): x,y = top-left, width,height = size. Omit "region" for text-only questions.
- If the sheet has numbered items (1, 2, 3...), output one object per item.
- If you cannot separate questions, return at least one item: [{ "problem": "Problem sheet – see image" }].

Example: [{"problem":"Solve the equation 2x plus 5 equals 11.","region":{"x":0.05,"y":0.1,"width":0.5,"height":0.2}},{"problem":"Draw the formation tree and list free variables.","region":{"x":0.05,"y":0.35,"width":0.9,"height":0.25}}]`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: sheetImageBase64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  })
  const raw = extractText(response)
  const cleaned = raw.replace(/^```[\w]*\s*/m, '').replace(/```\s*$/m, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) return [{ problem: 'Problem sheet – see image' }]
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
  try {
    const arr = JSON.parse(match[0]) as unknown
    if (!Array.isArray(arr)) return [{ problem: 'Problem sheet – see image' }]
    return arr
      .filter((x): x is { problem?: string; region?: { x?: number; y?: number; width?: number; height?: number } } => x !== null && typeof x === 'object')
      .map((item) => {
        const problem = typeof item.problem === 'string' && item.problem.trim() ? item.problem.trim() : 'Question'
        const region = item.region && typeof item.region === 'object'
          ? {
              x: clamp01(Number(item.region.x) || 0),
              y: clamp01(Number(item.region.y) || 0),
              width: clamp01(Number(item.region.width) || 0.5),
              height: clamp01(Number(item.region.height) || 0.25),
            }
          : undefined
        return { problem, region }
      })
  } catch {
    return [{ problem: 'Problem sheet – see image' }]
  }
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

/** Graph spec for visual aid: parabola, line, or point set. */
export type TutorGraphSpec =
  | { type: 'quadratic'; a: number; b: number; c: number; xMin: number; xMax: number }
  | { type: 'line'; slope: number; intercept: number; xMin: number; xMax: number }
  | { type: 'points'; points: [number, number][]; xMin?: number; xMax?: number; yMin?: number; yMax?: number }

export interface TutorResponse {
  /** Short supplemental text for the chat (key points, 1–2 lines). Not a transcript of what is spoken. */
  content: string
  /** Full conversational reply to speak aloud via TTS. */
  speak: string
  /** When true, this message is a question for the student to answer. Mic disabled until they answer. */
  isQuestion?: boolean
  /** Optional equation to display when discussing a formula. */
  equation?: string
  /** Optional graph to display when discussing a function or relationship. */
  graph?: TutorGraphSpec
  /** When set, navigate to the video generator after speaking — value is the topic/question to pre-fill. */
  openVideo?: string
}

export interface EvaluateAnswerResult {
  correct: boolean
  content: string
  speak: string
}

export type TutorContext = {
  userName?: string
  solves: Array<{ problem: string; status: string; finalFeedback?: string }>
  memory?: { topicsCovered: string[]; weaknesses: string[]; solveSummaries: string[] }
  userContext?: string
  /** Summarised recent conversations for continuity across sessions */
  previousConversationContext?: string
}

function buildTutorContext(context: TutorContext) {
  const name = context.userName ? `The student's name is ${context.userName}.` : ''
  const memorySections: string[] = []
  if (context.previousConversationContext)
    memorySections.push(`Previous sessions with this student:\n${context.previousConversationContext}`)
  if (context.userContext) memorySections.push(`Student profile: ${context.userContext}`)
  if (context.memory) {
    const { topicsCovered, weaknesses, solveSummaries } = context.memory
    if (topicsCovered.length)
      memorySections.push(`Topics the student has covered: ${topicsCovered.join(', ')}.`)
    if (weaknesses.length)
      memorySections.push(`Known areas of difficulty: ${weaknesses.join(', ')}.`)
    if (solveSummaries.length) {
      const recent = solveSummaries.slice(-5)
      memorySections.push(`Recent problem summaries:\n${recent.map((s) => `- ${s}`).join('\n')}`)
    }
  }
  return { name, memorySections }
}

export async function chatWithTutor(
  messages: TutorMessage[],
  context: TutorContext
): Promise<string> {
  const client = getClient()
  const { name, memorySections } = buildTutorContext(context)

  const systemPrompt = `You are Epsilon-Delta, a warm and encouraging maths tutor having a voice conversation with a student. ${name}
${memorySections.length ? '\n' + memorySections.join('\n') : ''}

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

export async function chatWithTutorStructured(
  messages: TutorMessage[],
  context: TutorContext & { mathematicianName?: string }
): Promise<TutorResponse> {
  const client = getClient()
  const { name, memorySections } = buildTutorContext(context)
  const tutorName = context.mathematicianName ?? 'Epsilon-Delta'
  const systemPrompt = `You are ${tutorName}, a warm maths tutor in a voice conversation. The student hears you (TTS) and sees a short on-screen summary. ${name}
${memorySections.length ? '\n' + memorySections.join('\n') : ''}

Reply with a JSON object only: {"content":"...","speak":"...","isQuestion":false,"equation":"optional","graph":"optional","openVideo":"optional"}

- speak: What to say aloud (TTS). Plain English, 1-3 short sentences. Use words for maths: "x squared" not "x²". Be specific and helpful — avoid vague phrases like "you need to understand". Explain the actual step or concept clearly.
ANTI-REPETITION: Do NOT repeat what you have already said in this conversation. If the student asks for an example, give a NEW example — vary numbers, wording, and approach. Remember what you've already explained and build on it; never parrot earlier content.
- content: SHORT on-screen summary that SUPPLEMENTS what you say — key point or takeaway in 1 line. NOT a transcript. No LaTeX. Be concrete (e.g. "Factor pairs of 6: 2 and 3 give middle term").
- isQuestion: ALWAYS false or omit. This endpoint is for normal replies only. Never set true.
- equation: Only when discussing a specific equation. Plain form e.g. "x² + 5x + 6 = 0". Omit if not relevant.
- graph: Only when a graph helps (parabola, line, plot). Use one of:
  - {"type":"quadratic","a":1,"b":0,"c":0,"xMin":-5,"xMax":5} for y = ax² + bx + c
  - {"type":"line","slope":1,"intercept":0,"xMin":-5,"xMax":5} for y = mx + c
  - {"type":"points","points":[[0,0],[1,1],[2,4]],"xMin":0,"xMax":5,"yMin":0,"yMax":10}
  Omit graph if not relevant.
- openVideo: Set ONLY when the student explicitly asks for a video explanation (e.g. "show me a video", "can you make a video about this", "video explanation please"). Value should be a concise topic or question derived from the conversation (e.g. "Explain how to solve quadratic equations by factorising"). Omit otherwise.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 280,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  const raw = (response.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? ''
  const stripped = raw.replace(/^```\w*\s*/, '').replace(/\s*```$/, '').trim()
  // Extract JSON object from text (model may add extra prose before/after)
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  const jsonStr = jsonMatch ? jsonMatch[0] : stripped
  const fallback = "I'm here to help — what would you like to work on?"
  try {
    const parsed = JSON.parse(jsonStr) as TutorResponse
    const speak = (typeof parsed.speak === 'string' ? parsed.speak : null)
      ?? (typeof parsed.content === 'string' ? parsed.content : null)
    return {
      content: (typeof parsed.content === 'string' ? parsed.content : null) ?? speak?.slice(0, 80) ?? 'Key point',
      speak: (speak && !speak.includes('{') && !speak.includes('}')) ? speak : fallback,
      isQuestion: !!parsed.isQuestion,
      equation: parsed.equation,
      graph: parsed.graph,
      openVideo: typeof parsed.openVideo === 'string' && parsed.openVideo.trim() ? parsed.openVideo.trim() : undefined,
    }
  } catch {
    return { content: 'Key point', speak: fallback }
  }
}

export async function tutorAskQuestion(
  messages: TutorMessage[],
  context: TutorContext & { mathematicianName?: string }
): Promise<string> {
  const client = getClient()
  const { name, memorySections } = buildTutorContext(context)
  const tutorName = context.mathematicianName ?? 'Epsilon-Delta'
  const systemPrompt = `You are ${tutorName}, a maths tutor. ${name}
${memorySections.length ? '\n' + memorySections.join('\n') : ''}

Based on the conversation so far, ask the student exactly ONE short question to check understanding. Make it specific and answerable (e.g. "What do we get when we factor x squared plus 5 x plus 6?"). Do NOT repeat a question you have already asked. Reply with only the question, plain English, one sentence.`

  const appended = [...messages, { role: 'user' as const, content: '[Please ask the student one question based on our conversation that they should answer.]' }]
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    system: systemPrompt,
    messages: appended.map((m) => ({ role: m.role, content: m.content })),
  })

  const block = response.content.find((b) => b.type === 'text')
  return block?.type === 'text' ? block.text : 'What part would you like to go over again?'
}

export async function evaluateAnswer(
  messages: TutorMessage[],
  userAnswer: string,
  context: TutorContext & { mathematicianName?: string }
): Promise<EvaluateAnswerResult> {
  const client = getClient()
  const { name, memorySections } = buildTutorContext(context)
  const tutorName = context.mathematicianName ?? 'Epsilon-Delta'
  const question = messages.filter((m) => m.role === 'assistant').pop()?.content ?? ''
  const systemPrompt = `You are ${tutorName}, a maths tutor. ${name}
${memorySections.length ? '\n' + memorySections.join('\n') : ''}

You asked the student: "${question}"
Their answer: "${userAnswer}"

Reply with a JSON object only: {"correct":true|false,"content":"...","speak":"..."}

- correct: true if the answer is substantially right (allow wording differences). false if wrong or incomplete.
- content: SHORT on-screen summary (1 line). If correct: brief positive (e.g. "Correct — you factored it right"). If wrong: key point they missed (e.g. "Check the sign of the constant term").
- speak: What to say aloud (TTS). Plain English, 1-3 short sentences. If CORRECT: brief praise. If WRONG: explain clearly WHY it is wrong and what the right approach is. Be specific — name the mistake and the correct step. Avoid vague phrases like "you need to think about it". No LaTeX, use words for maths.`

  const appended = [...messages, { role: 'user' as const, content: userAnswer }]
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: systemPrompt,
    messages: appended.map((m) => ({ role: m.role, content: m.content })),
  })

  const raw = (response.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? ''
  const jsonMatch = raw.replace(/^```\w*\s*/, '').replace(/\s*```$/, '').trim().match(/\{[\s\S]*\}/)
  const jsonStr = jsonMatch ? jsonMatch[0] : raw
  try {
    const parsed = JSON.parse(jsonStr) as EvaluateAnswerResult
    const speak = typeof parsed.speak === 'string' ? parsed.speak : 'Good try — let me explain.'
    return {
      correct: !!parsed.correct,
      content: typeof parsed.content === 'string' ? parsed.content : (parsed.correct ? 'Correct.' : 'Not quite.'),
      speak: speak.includes('{') || speak.includes('}') ? 'Good try — let me explain.' : speak,
    }
  } catch {
    return { correct: false, content: 'Let me explain.', speak: 'Good try — let me walk you through it.' }
  }
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
