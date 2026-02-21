import Anthropic from '@anthropic-ai/sdk'

function getClient() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set in your .env file')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

export interface CheckResult {
  feedback: string
  isCorrect: boolean
  hints: string[]
  encouragement: string
}

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === 'text')
  return block?.type === 'text' ? block.text : ''
}

function parseCheckResult(raw: string): CheckResult {
  const fallback: CheckResult = { feedback: 'Looking good — keep going!', isCorrect: false, hints: [], encouragement: 'Keep it up!' }

  // Strip markdown code fences that Claude sometimes wraps JSON in
  const text = raw.replace(/^```[\w]*\s*/m, '').replace(/```\s*$/m, '').trim()

  // Attempt 1: the whole cleaned string is valid JSON
  try { return JSON.parse(text) as CheckResult } catch { /* continue */ }

  // Attempt 2: extract the first {...} block (handles trailing prose)
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) as CheckResult } catch { /* continue */ }
  }

  console.warn('[claude] Could not parse feedback JSON. Raw response:', raw)
  return fallback
}

// Periodic check — short and fast, no extended thinking
export async function checkWorking(
  problem: string,
  workingBase64: string,
  previousFeedback?: string,
): Promise<CheckResult> {
  const client = getClient()

  // Giving Claude an exact example is the most reliable way to get back pure JSON.
  // IMPORTANT: all text must be plain English — no maths symbols, no LaTeX, no notation.
  // Write everything in words: "x squared" not "x²", "plus" not "+", "equals" not "=".
  const prompt = `You are a maths tutor reviewing a student's handwritten work.
Problem: "${problem}"${previousFeedback ? `\nPrevious feedback: "${previousFeedback}"` : ''}

Look at the image and reply with ONLY a raw JSON object — no markdown, no code fences, no explanation. Use exactly this shape:
{"feedback":"1-2 specific sentences about what is correct and where any error is.","isCorrect":false,"hints":["one concrete next step if wrong, else leave array empty"],"encouragement":"Short upbeat phrase."}

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

// After a solve completes, update the agent memory with new topics/weaknesses/summary
export async function refreshMemory(
  current: { topicsCovered: string[]; weaknesses: string[]; solveSummaries: string[] },
  solve: { problem: string; finalFeedback: string; hints: string[] },
): Promise<{ topicsCovered: string[]; weaknesses: string[]; solveSummaries: string[] }> {
  const client = getClient()

  const prompt = `You are an AI analysing a student's maths work to update their learning profile.

Problem: "${solve.problem}"
Final feedback: "${solve.finalFeedback}"
${solve.hints.length ? `Hints given during the session: ${solve.hints.slice(0, 5).join('; ')}` : ''}

Current topics covered: ${JSON.stringify(current.topicsCovered)}
Current weaknesses: ${JSON.stringify(current.weaknesses)}

Produce a raw JSON object (no markdown, no code fences) with exactly these keys:
{
  "topicsCovered": [...],
  "weaknesses": [...],
  "solveSummary": "..."
}

Rules:
- "topicsCovered": merge the existing list with 1–2 new topic tags for this problem (e.g. "integration by parts", "quadratic equations"). No duplicates. Max 20 total.
- "weaknesses": update the existing list — add newly observed weaknesses, remove any that seem resolved. Keep to the 5 most relevant. Use short phrases.
- "solveSummary": one sentence describing the problem and how the student did. Plain English, no symbols.`

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
    }
    const summaries = [...current.solveSummaries, parsed.solveSummary].slice(-20)
    return {
      topicsCovered: parsed.topicsCovered ?? current.topicsCovered,
      weaknesses: parsed.weaknesses ?? current.weaknesses,
      solveSummaries: summaries,
    }
  } catch {
    console.warn('[claude] refreshMemory parse failed, returning current memory')
    return current
  }
}

// Voice tutor — fast conversational AI
export interface TutorMessage { role: 'user' | 'assistant'; content: string }

export async function chatWithTutor(
  messages: TutorMessage[],
  context: {
    userName?: string
    solves: Array<{ problem: string; status: string; finalFeedback?: string }>
    memory?: { topicsCovered: string[]; weaknesses: string[]; solveSummaries: string[] }
  }
): Promise<string> {
  const client = getClient()

  const name = context.userName ? `The student's name is ${context.userName}.` : ''

  const memorySections: string[] = []
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

// Final feedback — slightly more detail, still concise
export async function getFinalFeedback(
  problem: string,
  finalWorkingBase64: string,
): Promise<string> {
  const client = getClient()

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: finalWorkingBase64 } },
          {
            type: 'text',
            text: `Maths tutor. Problem: "${problem}". Give a final verdict in 2 sentences: did they get it right, and one piece of encouragement. Write everything in plain English words only — no mathematical symbols, no LaTeX, no notation of any kind.`,
          },
        ],
      },
    ],
  })

  return extractText(response) || 'Well done — session saved.'
}
