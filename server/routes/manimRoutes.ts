import { Router, Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireFirebaseAuth, FirebaseAuthRequest } from '../middleware/requireFirebaseAuth'
import { getUserContextForVideo } from '../lib/getUserMetadataServer'

const router = Router()

// ---------------------------------------------------------------------------
// Deployable video system: Claude generates JSON, browser renders + Web Speech API
// No Manim, ffmpeg, or Python required.
// ---------------------------------------------------------------------------

/** Fix common JSON issues: unquoted string values like "type": equation -> "type": "equation" */
function repairedJson(str: string): string {
  // Quote unquoted identifiers after known string keys (type, style, animation, action)
  return str.replace(
    /"(type|style|animation|action)":\s*([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*[,}\]])/g,
    (_, key, val) => `"${key}": "${val}"`
  )
}

async function generateScenePlan(question: string, userContext?: string): Promise<{ segments: SceneSegment[] }> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? process.env.VITE_ANTHROPIC_API_KEY ?? '').trim()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY or VITE_ANTHROPIC_API_KEY not configured')

  const client = new Anthropic({ apiKey })

  const personalisation = userContext?.trim()
    ? `\n\nSTUDENT CONTEXT (use to tailor difficulty, pacing, content depth, and explanations — every video should reflect this user):\n${userContext}\n`
    : ''

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `You are creating a 3Blue1Brown-style math video (1.5–2 minutes, browser-rendered). Use Manim-inspired concepts: FadeIn, Write, GrowFromCenter, Transform/Replace, Indicate, Circumscribe, Axes, FunctionGraph, MathTex, Table, Arrow. Keep a fixed 16:9 presentation frame in mind.

Problem/Topic: "${question}"${personalisation}

Return ONLY a raw JSON object — no markdown, no code fences:
{
  "segments": [
    {
      "narration": "One complete sentence. Natural, fluid explanation. 30–45 words. Do not cut mid-thought.",
      "duration": 7,
      "steps": [
        { "action": "show", "type": "text", "content": "…", "color": "blue", "animation": "grow" },
        { "action": "show", "type": "equation", "latex": "…", "color": "blue", "animation": "write" },
        { "action": "show", "type": "graph", "formula": "x*x", "xRange": [-4,4], "yRange": [-2,12], "color": "blue" },
        { "action": "show", "type": "table", "rows": [["a","b"],["c","d"]], "headers": ["x","y"] },
        { "action": "show", "type": "arrow", "label": "→", "color": "yellow" },
        { "action": "layout", "type": "shrinkUp" },
        { "action": "replace", "index": 0, "type": "equation", "latex": "new expression", "color": "green" },
        { "action": "highlight", "index": 0, "style": "circumscribe" },
        { "action": "hide", "index": 0 }
      ]
    }
  ]
}

━━━ MANIM-STYLE ANIMATIONS (map to animation field) ━━━
- fadeIn: gentle appear (FadeIn style)
- write: draw/type in (Write style) — use for equations, formulas
- grow: scale from center (GrowFromCenter style) — use for graphs, diagrams

━━━ ACTIONS ━━━
show: add element. type: text | equation | graph | table | arrow
replace: change element at index (Transform/ReplacementTransform style)
hide: remove at index
layout: type "shrinkUp" — compact previous content upward for new material
highlight: index + style "indicate" (pulse) | "circumscribe" (border outline)

━━━ ELEMENT TYPES ━━━
text: content (string), color: white|blue|green only, animation
equation: latex (LaTeX), color: white|blue|green only, animation
graph: formula (JS: "x*x", "Math.sin(x)"), xRange [min,max], yRange [min,max], color
table: rows [[...]], headers (optional), keep small (max 4x4)
arrow: label (optional), color

━━━ COLORS (2–3 max) ━━━
white: primary text | blue: accent, graphs | green: highlight, conclusion

━━━ QUALITY RULES ━━━
- 12–16 segments, duration 6–8 sec each
- Narration: 30–45 words, complete sentences, no mid-thought cuts
- 16:9 frame: max 4–5 visible elements; use layout "shrinkUp" or hide older elements
- No overlap: space elements; keep graphs small; hide before adding many new elements
- First 2: intro; middle: step-by-step; final 2: conclusion (green)`,
    }],
  })

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
  let cleaned = raw.replace(/^```[\w]*\s*/m, '').replace(/```\s*$/m, '').trim()

  // Repair common JSON issues: unquoted string values (e.g. "type": equation -> "type": "equation")
  cleaned = repairedJson(cleaned)

  let plan: { segments: SceneSegment[] }
  try {
    plan = JSON.parse(cleaned) as { segments: SceneSegment[] }
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        plan = JSON.parse(repairedJson(match[0])) as { segments: SceneSegment[] }
      } catch {
        throw new Error('Claude returned invalid JSON: ' + (e instanceof Error ? e.message : String(e)))
      }
    } else {
      throw new Error('Claude returned invalid JSON: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // Normalize segments: narration, duration, steps, colors
  const PALETTE = ['white', 'blue', 'green'] as const
  const toPalette = (c: unknown): typeof PALETTE[number] => {
    const s = String(c ?? 'white').toLowerCase()
    if (s === 'green') return 'green'
    if (s === 'blue' || s === 'yellow' || s === 'red' || s === 'orange') return 'blue'
    return 'white'
  }

  plan.segments = (plan.segments ?? []).filter((s): s is SceneSegment => Boolean(s))
  for (const seg of plan.segments) {
    if (!seg.narration || typeof seg.narration !== 'string') seg.narration = ''
    if (typeof seg.duration !== 'number' || seg.duration < 4) seg.duration = 6
    if (!Array.isArray(seg.steps)) seg.steps = []
    for (const step of seg.steps as { color?: unknown }[]) {
      if (step && typeof step === 'object' && 'color' in step) step.color = toPalette(step.color)
    }
  }

  return plan
}

// Minimal types for API (full types in frontend)
interface SceneSegment {
  narration: string
  duration: number
  steps: unknown[]
}

const skipAuth = (process.env.MANIM_SKIP_AUTH ?? '').toLowerCase() === '1' || (process.env.MANIM_SKIP_AUTH ?? '').toLowerCase() === 'true'

router.post('/generate', (req: Request, res: Response, next: Function) => {
  if (skipAuth) return next()
  requireFirebaseAuth(req as FirebaseAuthRequest, res, next)
}, (req: FirebaseAuthRequest, res: Response, next: Function) => {
  void handler(req, res).catch(next)
})

async function handler(req: FirebaseAuthRequest, res: Response): Promise<void> {
  const { question } = (req.body as { question?: string }) ?? {}
  if (!question?.trim()) {
    res.status(400).json({ error: 'question is required' })
    return
  }
  try {
    const uid = req.uid
    const userContext = uid ? await getUserContextForVideo(uid) : undefined
    const plan = await generateScenePlan(question.trim(), userContext)
    if (!plan.segments?.length) throw new Error('No segments generated')
    res.json(plan)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[video] Error:', msg)
    if (!res.headersSent) res.status(500).json({ error: msg })
  }
}

export default router
