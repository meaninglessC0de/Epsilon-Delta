import { Router, Request, Response } from 'express'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import os from 'os'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthRequest } from '../middleware/requireAuth'

const execFileAsync = promisify(execFile)
const router = Router()

// ---------------------------------------------------------------------------
// Tool path resolution — search common Homebrew + system locations
// ---------------------------------------------------------------------------

const SEARCH_PATHS = [
  '/opt/homebrew/bin',   // macOS Apple Silicon
  '/usr/local/bin',      // macOS Intel
  '/usr/bin',
  '/bin',
]

function resolveBin(name: string): string {
  for (const dir of SEARCH_PATHS) {
    const full = path.join(dir, name)
    if (fs.existsSync(full)) return full
  }
  return name // fall back to PATH lookup; will give a clear ENOENT if missing
}

function checkTools(): { ok: boolean; missing: string[] } {
  const required = ['ffmpeg', 'ffprobe', 'manim']
  const missing = required.filter((t) => {
    const resolved = resolveBin(t)
    if (resolved !== t) return false   // found via SEARCH_PATHS
    // check PATH
    try {
      require('child_process').execFileSync(t, ['--version'], { stdio: 'ignore' })
      return false
    } catch {
      return true
    }
  })
  return { ok: missing.length === 0, missing }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Segment {
  narration: string
  manimCode: string
}

interface ScenePlan {
  segments: Segment[]
}

// ---------------------------------------------------------------------------
// Step 1 — Claude generates the segment plan
// ---------------------------------------------------------------------------

async function generateScenePlan(question: string): Promise<ScenePlan> {
  const apiKey = process.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not configured on server')

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `You are creating a visually rich Manim animation to explain a maths problem. Think like 3Blue1Brown — use colour, motion, and visual elements to make the maths feel alive and intuitive.

Problem: "${question}"

Return ONLY a raw JSON object — no markdown, no code fences:
{
  "segments": [
    {
      "narration": "Plain English, 1–2 sentences, no symbols. 15–25 words.",
      "manimCode": "Python lines inside construct(self). No class/def. Variables from earlier segments remain in scope. Do NOT add self.wait() — added automatically."
    }
  ]
}

━━━ AVAILABLE MANIM TOOLS ━━━

TEXT & EQUATIONS (no LaTeX — use Unicode):
  Text("x² + 5x + 6 = 0", font_size=44, color=WHITE)
  Text("= 0", font_size=44, color=GREEN)
  Unicode: ², ³, √, π, ×, ÷, ±, ≠, ≤, ≥, →, ∞

BUILD EQUATIONS PART BY PART (most visually impressive):
  lhs = Text("x²", color=BLUE, font_size=48)
  mid = Text(" + 5x + 6", color=WHITE, font_size=48)
  rhs = Text(" = 0", color=YELLOW, font_size=48)
  eq = VGroup(lhs, mid, rhs).arrange(RIGHT, buff=0.05)
  self.play(Write(lhs), run_time=0.8)
  self.play(Write(mid), run_time=0.8)
  self.play(Write(rhs), run_time=0.6)

ATTENTION & HIGHLIGHTING:
  self.play(Indicate(obj, color=YELLOW, scale_factor=1.3))          # pulse + colour
  self.play(Circumscribe(obj, color=YELLOW, run_time=1.5))          # draw circle around it
  box = SurroundingRectangle(obj, color=YELLOW, buff=0.15, corner_radius=0.1)
  self.play(Create(box))           # draw a box
  self.play(FadeOut(box))          # remove box

SHAPES & ARROWS:
  arrow = Arrow(start=UP*0.5, end=DOWN*0.5, color=YELLOW, buff=0.1)
  self.play(GrowArrow(arrow))
  line = Line(LEFT*3, RIGHT*3, color=GREY)
  self.play(Create(line))
  rect = Rectangle(width=4, height=1.2, color=BLUE, fill_opacity=0.15)
  self.play(Create(rect))
  dot = Dot(point=ORIGIN, color=RED, radius=0.12)
  self.play(FadeIn(dot))

ANIMATION VARIETY:
  self.play(Write(obj))                        # draw text stroke by stroke
  self.play(FadeIn(obj, shift=UP*0.3))         # fade in from below
  self.play(GrowFromCenter(obj))               # expand from centre
  self.play(DrawBorderThenFill(obj))           # outline then fill
  self.play(FadeOut(obj))
  self.play(ReplacementTransform(old, new))    # morph one object into another
  self.play(a.animate.set_color(GREEN))        # animate colour change
  self.play(a.animate.scale(1.4))              # animate scale
  self.play(FadeIn(a), FadeIn(b))             # simultaneous (faster, more dynamic)

LAYOUT:
  obj.to_edge(UP, buff=0.4)                    # before play — no animation
  obj.next_to(other, DOWN, buff=0.5)
  obj.move_to(ORIGIN)
  VGroup(a, b, c).arrange(DOWN, buff=0.35)
  VGroup(a, b).arrange(RIGHT, buff=0.1)

COLOUR PALETTE — use intentionally:
  WHITE   → default text
  BLUE    → unknowns / variables (x, y, n)
  YELLOW  → currently active / highlighted term
  GREEN   → correct answers / results
  RED     → errors or emphasis
  ORANGE  → intermediate results
  GREY    → supporting / secondary text

SCREEN MANAGEMENT (critical — screen fills fast):
  self.play(group.animate.to_edge(UP).scale(0.6))  # shrink and move old content up
  self.play(FadeOut(old_obj))                       # remove what you no longer need

━━━ VISUAL DESIGN RULES ━━━
1. Segment 1: Write the problem dramatically. Use part-by-part construction OR colour each term differently.
2. Middle segments: Each step should have ≥2 distinct visual actions (e.g. write + box + indicate). Change colours as new insight is revealed.
3. Use Indicate() or Circumscribe() whenever you refer to a specific part in the narration.
4. Show arithmetic/algebraic steps as on-screen transformations — don't just swap text.
5. Final segment: Reveal the answer in GREEN, use Circumscribe or a box, make it feel conclusive.
6. Run simultaneous animations (self.play(FadeIn(a), Write(b))) to make scenes feel dynamic.
7. Every segment should have at least one shape/arrow/box OR one attention animation.

━━━ CONSTRAINTS ━━━
- 5–7 segments, total ~25–30 seconds
- Each narration: 15–25 words
- Variables declared in one segment are available in all later segments

━━━ RICH EXAMPLE (quadratic factoring) ━━━
{
  "segments": [
    {
      "narration": "Let us solve x squared plus five x plus six equals zero by factoring.",
      "manimCode": "lhs = Text(\\"x²\\", color=BLUE, font_size=52)\\nrest = Text(\\" + 5x + 6 = 0\\", color=WHITE, font_size=52)\\neq = VGroup(lhs, rest).arrange(RIGHT, buff=0.05).move_to(ORIGIN)\\nself.play(GrowFromCenter(lhs), run_time=0.9)\\nself.play(Write(rest), run_time=1.0)"
    },
    {
      "narration": "We need two numbers that multiply to six and add up to five.",
      "manimCode": "self.play(eq.animate.to_edge(UP).scale(0.7))\\nprompt = Text(\\"? × ? = 6   and   ? + ? = 5\\", font_size=38, color=YELLOW)\\nself.play(FadeIn(prompt, shift=UP*0.3))\\nself.play(Indicate(prompt, scale_factor=1.1))"
    },
    {
      "narration": "The numbers two and three work perfectly — two times three is six and two plus three is five.",
      "manimCode": "answer = Text(\\"2 × 3 = 6  ✓     2 + 3 = 5  ✓\\", font_size=36, color=GREEN)\\nself.play(ReplacementTransform(prompt, answer))\\nself.play(Circumscribe(answer, color=GREEN, run_time=1.2))"
    },
    {
      "narration": "So we can factor the expression as x plus two times x plus three equals zero.",
      "manimCode": "self.play(FadeOut(answer))\\nfactored = Text(\\"(x + 2)(x + 3) = 0\\", font_size=48, color=WHITE)\\nfactored.next_to(eq, DOWN, buff=0.6)\\nself.play(Write(factored), run_time=1.2)\\nbox = SurroundingRectangle(factored, color=YELLOW, buff=0.2, corner_radius=0.1)\\nself.play(Create(box))"
    },
    {
      "narration": "Setting each factor to zero gives us x equals negative two or x equals negative three.",
      "manimCode": "self.play(FadeOut(box), factored.animate.to_edge(UP).scale(0.65))\\nsol1 = Text(\\"x = −2\\", color=GREEN, font_size=52)\\nsol2 = Text(\\"x = −3\\", color=GREEN, font_size=52)\\nsols = VGroup(sol1, sol2).arrange(RIGHT, buff=1.2).move_to(ORIGIN)\\nself.play(GrowFromCenter(sol1), GrowFromCenter(sol2))\\nself.play(Circumscribe(sol1, color=GREEN), Circumscribe(sol2, color=GREEN))"
    }
  ]
}`,
    }],
  })

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const cleaned = raw.replace(/^```[\w]*\s*/m, '').replace(/```\s*$/m, '').trim()

  try {
    return JSON.parse(cleaned) as ScenePlan
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as ScenePlan
    throw new Error('Claude returned invalid JSON for scene plan')
  }
}

// ---------------------------------------------------------------------------
// Step 2 — ElevenLabs TTS per segment, returns actual audio duration (seconds)
// ---------------------------------------------------------------------------

async function generateAudio(narration: string, outputPath: string): Promise<number> {
  const apiKey = (process.env.VITE_ELEVENLABS_API_KEY ?? '').trim()

  if (!apiKey) {
    // No TTS key — generate a silent MP3 whose length approximates speech rate
    const wordCount = narration.split(/\s+/).length
    const silentDuration = Math.max(3, Math.ceil(wordCount / 2.5))
    await execFileAsync(resolveBin('ffmpeg'), [
      '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono`,
      '-t', String(silentDuration),
      '-q:a', '9', '-acodec', 'libmp3lame',
      outputPath,
    ])
    return silentDuration
  }

  const voiceId = (process.env.VITE_ELEVENLABS_VOICE_ID ?? '9BWtsMINqrJLrRacOk9x').trim()

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: narration,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.45, similarity_boost: 0.75 },
    }),
  })

  if (!response.ok) {
    console.error('[manim] ElevenLabs error', response.status, await response.text())
    // Fallback: silent audio
    const silentDuration = Math.max(3, Math.ceil(narration.split(/\s+/).length / 2.5))
    await execFileAsync(resolveBin('ffmpeg'), [
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
      '-t', String(silentDuration),
      '-q:a', '9', '-acodec', 'libmp3lame',
      outputPath,
    ])
    return silentDuration
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  fs.writeFileSync(outputPath, buffer)

  // Measure actual duration
  const { stdout } = await execFileAsync(resolveBin('ffprobe'), [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    outputPath,
  ])
  return parseFloat(stdout.trim()) || Math.ceil(narration.split(/\s+/).length / 2.5)
}

// ---------------------------------------------------------------------------
// Step 3 — Build the Manim Python file with exact self.wait() durations
// ---------------------------------------------------------------------------

function buildManimPython(segments: Segment[], durations: number[]): string {
  const body = segments.map((seg, i) => {
    const indented = seg.manimCode
      .split('\n')
      .map((l) => '        ' + l)
      .join('\n')
    return `        # ── Segment ${i + 1} ──\n${indented}\n        self.wait(${durations[i].toFixed(2)})`
  }).join('\n\n')

  return `from manim import *\n\nclass MathScene(Scene):\n    def construct(self):\n${body}\n`
}

// ---------------------------------------------------------------------------
// Step 4 helper — find rendered MP4 in Manim's output tree
// ---------------------------------------------------------------------------

async function findRenderedVideo(mediaDir: string): Promise<string> {
  // Manim writes to: {mediaDir}/videos/{basename}/{quality}/MathScene.mp4
  async function walk(dir: string): Promise<string | null> {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        const found = await walk(full)
        if (found) return found
      } else if (e.name.endsWith('.mp4')) {
        return full
      }
    }
    return null
  }
  const found = await walk(mediaDir)
  if (!found) throw new Error('Manim produced no MP4 file')
  return found
}

// ---------------------------------------------------------------------------
// Route: POST /api/manim/generate
// ---------------------------------------------------------------------------

router.post('/generate', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { question } = req.body as { question?: string }

  if (!question?.trim()) {
    res.status(400).json({ error: 'question is required' })
    return
  }

  const { ok, missing } = checkTools()
  if (!ok) {
    res.status(503).json({
      error: `Missing required tools: ${missing.join(', ')}. Install with: brew install ffmpeg && pip install manim`,
    })
    return
  }

  const tmpDir = path.join(os.tmpdir(), `manim-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  try {
    await fsp.mkdir(tmpDir, { recursive: true })

    // ── 1. Scene plan ──────────────────────────────────────────────────────
    console.log('[manim] Generating scene plan…')
    const plan = await generateScenePlan(question.trim())
    if (!plan.segments?.length) throw new Error('Claude returned no segments')
    console.log(`[manim] ${plan.segments.length} segments`)

    // ── 2. TTS for every segment in parallel ───────────────────────────────
    console.log('[manim] Generating audio…')
    const audioPaths = plan.segments.map((_, i) => path.join(tmpDir, `seg${i}.mp3`))
    const durations = await Promise.all(
      plan.segments.map((seg, i) => generateAudio(seg.narration, audioPaths[i]))
    )
    console.log('[manim] Durations:', durations)

    // ── 3. Write Manim Python file ─────────────────────────────────────────
    const pythonCode = buildManimPython(plan.segments, durations)
    const pyPath = path.join(tmpDir, 'scene.py')
    await fsp.writeFile(pyPath, pythonCode)
    console.log('[manim] Python:\n', pythonCode)

    // ── 4. Render with Manim ───────────────────────────────────────────────
    console.log('[manim] Rendering…')
    const mediaDir = path.join(tmpDir, 'media')
    try {
      await execFileAsync(resolveBin('manim'), [
        '-ql',
        '--media_dir', mediaDir,
        '--disable_caching',
        pyPath, 'MathScene',
      ], { timeout: 180_000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Manim render failed:\n${msg}\n\nGenerated code:\n${pythonCode}`)
    }

    const videoPath = await findRenderedVideo(mediaDir)
    console.log('[manim] Video:', videoPath)

    // ── 5. Concatenate audio segments ──────────────────────────────────────
    const concatListPath = path.join(tmpDir, 'concat.txt')
    await fsp.writeFile(concatListPath, audioPaths.map((p) => `file '${p}'`).join('\n'))

    const fullAudioPath = path.join(tmpDir, 'audio.mp3')
    await execFileAsync(resolveBin('ffmpeg'), [
      '-f', 'concat', '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      fullAudioPath,
    ])

    // ── 6. Merge video + audio ─────────────────────────────────────────────
    const finalPath = path.join(tmpDir, 'final.mp4')
    await execFileAsync(resolveBin('ffmpeg'), [
      '-i', videoPath,
      '-i', fullAudioPath,
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k',
      '-shortest',
      finalPath,
    ])

    // ── 7. Stream response ─────────────────────────────────────────────────
    const stat = await fsp.stat(finalPath)
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Content-Disposition', 'inline; filename="explanation.mp4"')

    const stream = fs.createReadStream(finalPath)
    stream.pipe(res)
    stream.on('end', () => {
      fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    })
    stream.on('error', () => {
      fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    })

  } catch (err) {
    console.error('[manim] Error:', err)
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      res.status(500).json({ error: msg })
    }
  }
})

export default router
