/**
 * Gender and speaking mannerisms per mathematician for TTS (voice choice + settings)
 * and for Claude (speaking style in system prompt).
 * Female mathematicians get a female voice; all others get a male voice.
 */

export type MathematicianGender = 'male' | 'female'

export interface MathematicianMetadata {
  gender: MathematicianGender
  /** One sentence for the LLM: how this mathematician speaks (style, tone, mannerisms). */
  speakingStyle: string
  /** ElevenLabs stability 0–1: lower = more expressive/varied. */
  voiceStability?: number
  /** ElevenLabs style 0–1: natural style variation. */
  voiceStyle?: number
}

/** Female mathematicians in our list (for voice selection). */
const FEMALE_NAMES = new Set([
  'Hypatia',
  'Noether',
  'Lovelace',
  'Kovalevskaya',
  'Germain',
])

/** Mannerisms and voice hints by name. Defaults used when not listed. */
const METADATA: Record<string, Omit<MathematicianMetadata, 'gender'>> = {
  Euler: {
    speakingStyle: 'You speak with enthusiasm and clarity, often making connections between ideas and encouraging the student with warmth.',
    voiceStability: 0.35,
    voiceStyle: 0.4,
  },
  Gauss: {
    speakingStyle: 'You speak with precision and economy; you are concise and rigorous, but still patient and clear.',
    voiceStability: 0.5,
    voiceStyle: 0.25,
  },
  Riemann: {
    speakingStyle: 'You speak in a thoughtful, conceptual way, focusing on the big picture and geometric intuition.',
    voiceStability: 0.45,
    voiceStyle: 0.3,
  },
  Newton: {
    speakingStyle: 'You speak in a formal, precise manner; you are methodical and encourage step-by-step thinking.',
    voiceStability: 0.55,
    voiceStyle: 0.2,
  },
  Leibniz: {
    speakingStyle: 'You speak with clarity and a touch of elegance; you like to organise ideas and notation clearly.',
    voiceStability: 0.4,
    voiceStyle: 0.35,
  },
  Descartes: {
    speakingStyle: 'You speak in a clear, logical order—building from first principles and encouraging systematic reasoning.',
    voiceStability: 0.5,
    voiceStyle: 0.25,
  },
  Hypatia: {
    speakingStyle: 'You speak with clarity and pedagogical care; you are eloquent and make ideas accessible without dumbing them down.',
    voiceStability: 0.38,
    voiceStyle: 0.4,
  },
  Noether: {
    speakingStyle: 'You speak with structural clarity and focus on patterns and symmetry; you are precise and encouraging.',
    voiceStability: 0.42,
    voiceStyle: 0.35,
  },
  Lovelace: {
    speakingStyle: 'You speak with imagination and precision; you use vivid analogies and connect computation to ideas.',
    voiceStability: 0.35,
    voiceStyle: 0.45,
  },
  Turing: {
    speakingStyle: 'You speak in a direct, logical way; you are clear and constructive, with a quiet encouragement.',
    voiceStability: 0.45,
    voiceStyle: 0.3,
  },
  Ramanujan: {
    speakingStyle: 'You speak with intuition and wonder; you often see elegant patterns and share them with gentle enthusiasm.',
    voiceStability: 0.32,
    voiceStyle: 0.45,
  },
  Kovalevskaya: {
    speakingStyle: 'You speak with determination and clarity; you are encouraging and emphasise persistence and rigour.',
    voiceStability: 0.4,
    voiceStyle: 0.38,
  },
  Germain: {
    speakingStyle: 'You speak with quiet persistence and intellectual courage; you are precise and supportive.',
    voiceStability: 0.44,
    voiceStyle: 0.32,
  },
  Hilbert: {
    speakingStyle: 'You speak with optimism and clarity; you believe problems can be solved and encourage the student to try.',
    voiceStability: 0.4,
    voiceStyle: 0.35,
  },
  Archimedes: {
    speakingStyle: 'You speak with practical intuition and vivid examples; you connect abstract ideas to concrete situations.',
    voiceStability: 0.38,
    voiceStyle: 0.4,
  },
  Euclid: {
    speakingStyle: 'You speak in an orderly, axiomatic way—building from definitions and clear steps.',
    voiceStability: 0.5,
    voiceStyle: 0.22,
  },
  Pythagoras: {
    speakingStyle: 'You speak with a sense of pattern and harmony; you connect numbers and geometry in an intuitive way.',
    voiceStability: 0.4,
    voiceStyle: 0.35,
  },
  Pascal: {
    speakingStyle: 'You speak with clarity and concision; you are thoughtful and encourage careful reasoning.',
    voiceStability: 0.45,
    voiceStyle: 0.3,
  },
  Fermat: {
    speakingStyle: 'You speak with brevity and wit; you leave room for the student to discover and hint rather than over-explain.',
    voiceStability: 0.35,
    voiceStyle: 0.4,
  },
  Cantor: {
    speakingStyle: 'You speak with conceptual boldness and care; you help the student grapple with infinity and sets step by step.',
    voiceStability: 0.42,
    voiceStyle: 0.35,
  },
  Poincaré: {
    speakingStyle: 'You speak with intuition and breadth; you connect geometry, analysis, and physics in an accessible way.',
    voiceStability: 0.38,
    voiceStyle: 0.38,
  },
  'von Neumann': {
    speakingStyle: 'You speak with remarkable clarity and speed of thought; you are precise and make connections across fields.',
    voiceStability: 0.45,
    voiceStyle: 0.35,
  },
  Galileo: {
    speakingStyle: 'You speak with directness and emphasis on observation and experiment; you make abstract ideas concrete.',
    voiceStability: 0.4,
    voiceStyle: 0.38,
  },
  Kepler: {
    speakingStyle: 'You speak with wonder at patterns in nature and numbers; you are encouraging and visual.',
    voiceStability: 0.35,
    voiceStyle: 0.42,
  },
}

const DEFAULT_STYLE = 'You speak with warmth and clarity, encouraging the student and explaining step by step.'
const DEFAULT_STABILITY = 0.28
const DEFAULT_VOICE_STYLE = 0.35

/**
 * Returns metadata for a mathematician by display name (e.g. from getMathematicianForUser).
 * Used to pick ElevenLabs voice (by gender) and optional voice_settings, and to set
 * Claude speaking style in tutor prompts.
 */
export function getMathematicianMetadata(name: string): MathematicianMetadata {
  const gender: MathematicianGender = FEMALE_NAMES.has(name) ? 'female' : 'male'
  const overrides = METADATA[name]
  return {
    gender,
    speakingStyle: overrides?.speakingStyle ?? DEFAULT_STYLE,
    voiceStability: overrides?.voiceStability ?? DEFAULT_STABILITY,
    voiceStyle: overrides?.voiceStyle ?? DEFAULT_VOICE_STYLE,
  }
}
