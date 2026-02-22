import { getMathematicianMetadata } from './mathematicianMetadata'

// Default voices by gender (ElevenLabs premade: Aria = female, Adam = male)
const VOICE_ID_FEMALE = '9BWtsMINqrJLrRacOk9x'   // Aria
const VOICE_ID_MALE = 'pNInz6obpgDQGcFmaJgB'   // Adam
const DEFAULT_VOICE_ID = VOICE_ID_FEMALE

let currentAudio: HTMLAudioElement | null = null
let currentController: AbortController | null = null

/** Strip characters that cause TTS glitches or awkward pauses */
function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\w]*\n?/g, '')   // opening code fence (safety net if raw JSON leaks)
    .replace(/```/g, '')           // closing code fence
    .replace(/[{}\[\]]/g, '')      // JSON structural characters
    .replace(/"\s*:/g, '')         // JSON key-colon patterns
    .replace(/\*+/g, '')           // asterisks (markdown bold/italic)
    .replace(/\|/g, '')            // pipes
    .replace(/#+\s*/g, '')         // markdown headings
    .replace(/`[^`]*`/g, (m) => m.replace(/`/g, ''))  // inline code
    .replace(/_+/g, '')            // underscores
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // markdown links → just label
    // Math symbols → English words (safety net in case Claude includes any)
    .replace(/²/g, ' squared')
    .replace(/³/g, ' cubed')
    .replace(/⁰/g, ' to the power of zero')
    .replace(/¹/g, ' to the power of one')
    .replace(/⁴/g, ' to the power of four')
    .replace(/⁵/g, ' to the power of five')
    .replace(/⁶/g, ' to the power of six')
    .replace(/⁷/g, ' to the power of seven')
    .replace(/⁸/g, ' to the power of eight')
    .replace(/⁹/g, ' to the power of nine')
    .replace(/√/g, ' square root of ')
    .replace(/∛/g, ' cube root of ')
    .replace(/π/g, ' pi ')
    .replace(/∞/g, ' infinity ')
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/±/g, ' plus or minus ')
    .replace(/≠/g, ' not equal to ')
    .replace(/≈/g, ' approximately equal to ')
    .replace(/≤/g, ' less than or equal to ')
    .replace(/≥/g, ' greater than or equal to ')
    .replace(/∑/g, ' sum of ')
    .replace(/∫/g, ' integral of ')
    .replace(/∂/g, ' partial derivative of ')
    .replace(/∆/g, ' delta ')
    .replace(/θ/g, ' theta ')
    .replace(/α/g, ' alpha ')
    .replace(/β/g, ' beta ')
    .replace(/γ/g, ' gamma ')
    .replace(/λ/g, ' lambda ')
    .replace(/μ/g, ' mu ')
    .replace(/σ/g, ' sigma ')
    .replace(/φ/g, ' phi ')
    .replace(/ω/g, ' omega ')
    .replace(/\^(\w+)/g, ' to the power of $1 ')  // x^2 → x to the power of 2
    .replace(/\s{2,}/g, ' ')       // collapse whitespace
    .trim()
}

export interface SpeakTextOptions {
  onEnd?: () => void
  /** Mathematician display name (e.g. from getMathematicianForUser). Picks voice by gender and applies mannerism-based settings. */
  mathematicianName?: string
}

export async function speakText(
  rawText: string,
  optionsOrOnEnd?: SpeakTextOptions | (() => void)
): Promise<void> {
  const options: SpeakTextOptions =
    typeof optionsOrOnEnd === 'function' ? { onEnd: optionsOrOnEnd } : optionsOrOnEnd ?? {}
  const { onEnd, mathematicianName } = options

  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined
  if (!apiKey) {
    console.info('[ElevenLabs] VITE_ELEVENLABS_API_KEY not set — voice feedback disabled')
    try { onEnd?.() } catch { /* ignore */ }
    return
  }

  // Cancel any in-flight request + stop any playing audio BEFORE starting a new one.
  stopSpeaking()

  const controller = new AbortController()
  currentController = controller

  let voiceId: string
  let stability: number
  let style: number
  if (mathematicianName?.trim()) {
    const meta = getMathematicianMetadata(mathematicianName.trim())
    voiceId = meta.gender === 'female' ? VOICE_ID_FEMALE : VOICE_ID_MALE
    stability = meta.voiceStability ?? 0.28
    style = meta.voiceStyle ?? 0.35
  } else {
    voiceId =
      (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) ?? DEFAULT_VOICE_ID
    stability = 0.28
    style = 0.35
  }

  const text = cleanForSpeech(rawText).slice(0, 300)

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability,
          similarity_boost: 0.82,
          style,
          use_speaker_boost: true,
        },
      }),
    })

    // If we were cancelled while fetching, bail out before touching the DOM
    if (controller.signal.aborted) return

    if (!response.ok) {
      console.error(`[ElevenLabs] ${response.status}: ${await response.text()}`)
      try { onEnd?.() } catch { /* ignore */ }
      return
    }

    const url = URL.createObjectURL(await response.blob())

    // Check again — could have been cancelled while awaiting the blob
    if (controller.signal.aborted) {
      URL.revokeObjectURL(url)
      return
    }

    const audio = new Audio(url)
    currentAudio = audio

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(safetyTimer)
      URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
      try { onEnd?.() } catch { /* ignore */ }
    }

    const safetyTimer = setTimeout(finish, 45_000)

    audio.addEventListener('ended', finish)
    audio.addEventListener('error', finish)

    await audio.play()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
    console.error('[ElevenLabs]', err)
    try { onEnd?.() } catch { /* ignore */ }
  }
}

export function stopSpeaking(): void {
  // 1. Abort any pending HTTP request — prevents audio being created after unmount
  if (currentController) {
    currentController.abort()
    currentController = null
  }
  // 2. Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
}
