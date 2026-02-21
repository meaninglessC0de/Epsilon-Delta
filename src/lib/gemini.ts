import { GoogleGenerativeAI } from '@google/generative-ai'

function getModel() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not set in your .env file')
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
}

export interface CheckResult {
  feedback: string
  isCorrect: boolean
  hints: string[]
  encouragement: string
}

function parseJSON(text: string): CheckResult {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    return { feedback: text, isCorrect: false, hints: [], encouragement: 'Keep going!' }
  }
  try {
    return JSON.parse(match[0]) as CheckResult
  } catch {
    return { feedback: text, isCorrect: false, hints: [], encouragement: 'Keep going!' }
  }
}

export async function checkWorking(
  problem: string,
  workingBase64: string,
  previousFeedback?: string,
): Promise<CheckResult> {
  const model = getModel()

  const prompt = `You are an encouraging mathematics tutor reviewing a student's handwritten work.

Problem: "${problem}"
${previousFeedback ? `\nPrevious feedback you gave: "${previousFeedback}"` : ''}

Look at the student's working in the image. Give constructive, specific feedback.

Respond ONLY with valid JSON in this exact structure:
{
  "feedback": "2-3 sentences describing what you see and how the working looks so far. Be specific about the mathematics.",
  "isCorrect": true or false,
  "hints": ["one specific hint to help them continue if needed"],
  "encouragement": "One short encouraging sentence."
}`

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: workingBase64, mimeType: 'image/jpeg' } },
  ])

  return parseJSON(result.response.text())
}

export async function getFinalFeedback(
  problem: string,
  finalWorkingBase64: string,
): Promise<string> {
  const model = getModel()

  const prompt = `You are a mathematics tutor. A student has just finished solving this problem:

"${problem}"

Look at their complete solution in the image and give a final, comprehensive assessment in 3-4 sentences. Include: whether they got the right answer, any errors made, and positive reinforcement.`

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: finalWorkingBase64, mimeType: 'image/jpeg' } },
  ])

  return result.response.text()
}
