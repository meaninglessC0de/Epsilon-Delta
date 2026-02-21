/**
 * Standardized university-level math topics used for ELO and tagging.
 * Each topic has a base ELO of 1500 (updated as the user solves problems).
 */
export const MATH_TOPICS = [
  'algebra',
  'linear_algebra',
  'calculus',
  'real_analysis',
  'geometry',
  'topology',
  'probability',
  'statistics',
  'differential_equations',
  'number_theory',
  'discrete_math',
  'optimization',
  'complex_analysis',
  'abstract_algebra',
] as const

export type MathTopicId = (typeof MATH_TOPICS)[number]

export const DEFAULT_ELO = 1500
export const ELO_K_FACTOR = 32

/** Learning style (from indirect questions). */
export type LearningStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'mixed' | 'unsure'

/** Tone preference for feedback and content. */
export type TonePreference = 'funny_light' | 'balanced' | 'serious_technical' | 'unsure'

/** Environment preference when studying. */
export type EnvironmentPreference = 'quiet' | 'background_noise' | 'group' | 'unsure'

/** How they engage with content best. */
export type ContentEngagement = 'short_bites' | 'deep_dives' | 'examples_first' | 'theory_first' | 'unsure'

/** Procrastination level 1–5 (1 = rarely, 5 = very often). */
export type ProcrastinationLevel = 1 | 2 | 3 | 4 | 5
