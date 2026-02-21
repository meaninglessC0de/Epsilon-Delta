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
