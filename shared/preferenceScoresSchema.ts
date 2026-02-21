/**
 * All learning-preference dimensions as 1–5 ratings (no booleans).
 * Used for preference calculations so each student gets different material/decisions.
 * Keys are stable for storage and scoring.
 */
export type Rating = 1 | 2 | 3 | 4 | 5

export const PREFERENCE_CATEGORIES = {
  /** When learning something new, what helps most? (1=not much, 5=very much) */
  learningNew: {
    prompt: 'When you’re learning something new, how much does each of these help you?',
    options: [
      { key: 'diagrams', label: 'Seeing diagrams and sketches' },
      { key: 'listening', label: 'Listening to explanations' },
      { key: 'writing', label: 'Writing things out' },
      { key: 'teaching', label: 'Teaching someone else' },
      { key: 'solvingImmediately', label: 'Solving problems straight away' },
      { key: 'realWorldExamples', label: 'Watching real-world examples' },
      { key: 'theoryFirst', label: 'Understanding the theory first' },
    ],
  },
  /** When confused, what do you prefer? */
  whenConfused: {
    prompt: 'When you’re stuck or confused, how helpful is each of these?',
    options: [
      { key: 'simpler', label: 'A simpler explanation' },
      { key: 'deeper', label: 'A deeper explanation' },
      { key: 'visual', label: 'A visual explanation' },
      { key: 'stepByStep', label: 'A step-by-step breakdown' },
      { key: 'analogy', label: 'An analogy' },
    ],
  },
  /** Do you learn better when... */
  learnBetterWhen: {
    prompt: 'How much do you learn better when...',
    options: [
      { key: 'structured', label: 'Information is structured clearly' },
      { key: 'exploreFreely', label: 'You can explore freely' },
      { key: 'timePressure', label: 'You’re under some time pressure' },
      { key: 'zeroPressure', label: 'You have no time pressure' },
    ],
  },
  /** When being taught, do you prefer... */
  teachingStyle: {
    prompt: 'When someone is teaching you, how much do you prefer...',
    options: [
      { key: 'friendly', label: 'Friendly and encouraging' },
      { key: 'calm', label: 'Calm and neutral' },
      { key: 'direct', label: 'Direct and firm' },
      { key: 'energetic', label: 'Highly energetic' },
      { key: 'strict', label: 'Strict and disciplined' },
    ],
  },
  /** Do you respond better to... */
  feedbackResponse: {
    prompt: 'How do you usually respond to...',
    options: [
      { key: 'praise', label: 'Praise' },
      { key: 'constructiveCriticism', label: 'Constructive criticism' },
      { key: 'challenged', label: 'Being challenged' },
      { key: 'reassurance', label: 'Gentle reassurance' },
    ],
  },
  /** Do you prefer (order of content) */
  orderPreference: {
    prompt: 'How much do you like to start with...',
    options: [
      { key: 'bigPicture', label: 'A big-picture overview first' },
      { key: 'definitionsFirst', label: 'Definitions first' },
      { key: 'exampleFirst', label: 'An example first' },
      { key: 'problemFirst', label: 'A problem first' },
      { key: 'historical', label: 'Historical context' },
    ],
  },
  /** Guidance level */
  guidance: {
    prompt: 'When working through material, how much do you prefer...',
    options: [
      { key: 'guided', label: 'Being guided step-by-step' },
      { key: 'hintsWhenStuck', label: 'Hints only when you’re stuck' },
      { key: 'fullIndependence', label: 'Full independence' },
      { key: 'fullSolution', label: 'The entire solution given to you' },
    ],
  },
  /** Problem difficulty preference */
  problemDifficulty: {
    prompt: 'When solving problems, how much do you prefer...',
    options: [
      { key: 'easierWarmups', label: 'Easier warm-ups first' },
      { key: 'moderate', label: 'Moderate difficulty' },
      { key: 'immediateChallenge', label: 'Immediate challenge' },
      { key: 'veryHard', label: 'Very hard problems even if you fail' },
    ],
  },
  /** When you get something wrong */
  whenWrong: {
    prompt: 'When you get something wrong, how much do you want...',
    options: [
      { key: 'fullSolution', label: 'The full solution immediately' },
      { key: 'smallHint', label: 'A small hint' },
      { key: 'guidingQuestion', label: 'A question guiding you' },
      { key: 'retryFirst', label: 'Time to retry first' },
    ],
  },
  /** Explanation length */
  explanationLength: {
    prompt: 'How do you prefer explanations to be?',
    options: [
      { key: 'short', label: 'Short and concise' },
      { key: 'medium', label: 'Medium detail' },
      { key: 'thorough', label: 'Very thorough' },
      { key: 'ultraTechnical', label: 'Ultra-precise and technical' },
    ],
  },
  /** Explanation style */
  explanationStyle: {
    prompt: 'What kind of explanations work best for you?',
    options: [
      { key: 'concreteExamples', label: 'Concrete real-world examples' },
      { key: 'visualMetaphors', label: 'Visual metaphors' },
      { key: 'pureLogic', label: 'Pure logical reasoning' },
      { key: 'mathFormalism', label: 'Mathematical formalism' },
    ],
  },
  /** Format preference */
  formatPreference: {
    prompt: 'How do you prefer information to be presented?',
    options: [
      { key: 'bulletPoints', label: 'Bullet-point summaries' },
      { key: 'paragraphs', label: 'Paragraph explanations' },
      { key: 'flowcharts', label: 'Flowcharts' },
      { key: 'stepLists', label: 'Step-by-step lists' },
      { key: 'minimalText', label: 'Minimal text' },
    ],
  },

  // — Math-specific & working style (for content length, engagement, format) —

  /** How they prefer to encounter math (equations, notation, examples, etc.) — inferred from helpfulness. */
  mathContentPreference: {
    prompt: 'When a new math idea is introduced, how much does each of these help you get it?',
    options: [
      { key: 'equations', label: 'Seeing the main equations or formulas first' },
      { key: 'notation', label: 'Seeing formal notation and definitions' },
      { key: 'workedExample', label: 'A full worked example before trying myself' },
      { key: 'visual', label: 'A graph, diagram, or sketch' },
      { key: 'verbal', label: 'A short verbal explanation in words' },
      { key: 'applications', label: 'Where and why it’s used in practice' },
    ],
  },

  /** Working style: session length, attention span — influences video/written content length and engagement. */
  workingStyle: {
    prompt: 'How much does each of these describe how you usually study?',
    options: [
      { key: 'longSessions', label: 'I can focus for long stretches (e.g. 1–2 hours)' },
      { key: 'shortBursts', label: 'I prefer short sessions (e.g. 20–30 min)' },
      { key: 'shortAttention', label: 'I need to switch topics or take breaks often' },
      { key: 'longAttention', label: 'I can stay on one topic for a long time' },
      { key: 'needBreaks', label: 'Regular short breaks help me stay sharp' },
      { key: 'marathon', label: 'I like to go deep in one sitting without stopping' },
    ],
  },

  /** What they’re optimising for (understanding, breadth, exams, basics, etc.) — inferred from importance. */
  learningGoal: {
    prompt: 'When you learn math, how important is each of these to you?',
    options: [
      { key: 'understandMethods', label: 'Really understanding how and why a method works' },
      { key: 'learnMore', label: 'Learning more topics and ideas broadly' },
      { key: 'passExams', label: 'Being ready to perform in exams' },
      { key: 'improveBasics', label: 'Solidifying the fundamentals' },
      { key: 'applications', label: 'Using it in real situations or other subjects' },
      { key: 'research', label: 'Preparing for or doing more advanced or research-style work' },
    ],
  },

  /** Procedural vs holistic: step-by-step build-up vs big picture / all-in-one. */
  learningApproach: {
    prompt: 'How do you like to move through a new topic?',
    options: [
      { key: 'procedural', label: 'Step-by-step: build from basics, one block at a time' },
      { key: 'holistic', label: 'Big picture first: see the whole idea, then fill in details' },
      { key: 'spiral', label: 'Revisit the same idea at deeper levels over time' },
      { key: 'linear', label: 'One clear path from start to finish, in order' },
    ],
  },
} as const

/**
 * Short gamified questions used in onboarding. Answers are mapped into full PreferenceScores.
 * Each item is either a "would you rather" (two options) or "rate 1-5" or "pick one".
 */
export const GAMIFIED_QUESTIONS = [
  {
    id: 'exampleVsHints',
    type: 'wouldYouRather' as const,
    prompt: 'When you hit a new problem, would you rather…',
    options: [
      { label: 'See a full worked example first', set: { orderPreference: { exampleFirst: 5 }, guidance: { guided: 4 } } },
      { label: 'Try it with hints when I’m stuck', set: { guidance: { hintsWhenStuck: 5 }, orderPreference: { problemFirst: 4 } } },
    ],
  },
  {
    id: 'sessionLength',
    type: 'rate' as const,
    prompt: 'Rate 1–5: I prefer short study sessions (e.g. 20–30 min).',
    low: 'I like long sessions',
    high: 'Short sessions suit me',
    category: 'workingStyle' as const,
    optionKey: 'shortBursts',
  },
  {
    id: 'explanationLength',
    type: 'rate' as const,
    prompt: 'Rate 1–5: I like explanations short and to the point.',
    low: 'I want thorough detail',
    high: 'Keep it concise',
    category: 'explanationLength' as const,
    optionKey: 'short',
  },
  {
    id: 'goal',
    type: 'pickOne' as const,
    prompt: 'What’s your main goal right now?',
    options: [
      { label: 'Really understand how things work', set: { learningGoal: { understandMethods: 5 } } },
      { label: 'Pass exams', set: { learningGoal: { passExams: 5 } } },
      { label: 'Build strong basics', set: { learningGoal: { improveBasics: 5 } } },
      { label: 'Learn lots of topics', set: { learningGoal: { learnMore: 5 } } },
    ],
  },
  {
    id: 'approach',
    type: 'pickOne' as const,
    prompt: 'How do you like to tackle a new topic?',
    options: [
      { label: 'Step-by-step: build from basics', set: { learningApproach: { procedural: 5 } } },
      { label: 'Big picture first, then details', set: { learningApproach: { holistic: 5 } } },
    ],
  },
] as const

export type PreferenceScores = {
  [K in keyof typeof PREFERENCE_CATEGORIES]: Record<string, number>
}

const DEFAULT_RATING = 3

function defaultScoresForCategory(
  category: keyof typeof PREFERENCE_CATEGORIES
): Record<string, number> {
  const opts = PREFERENCE_CATEGORIES[category].options
  return Object.fromEntries(opts.map((o) => [o.key, DEFAULT_RATING]))
}

export function getDefaultPreferenceScores(): PreferenceScores {
  return Object.fromEntries(
    (Object.keys(PREFERENCE_CATEGORIES) as (keyof typeof PREFERENCE_CATEGORIES)[]).map((cat) => [
      cat,
      defaultScoresForCategory(cat),
    ])
  ) as PreferenceScores
}

export function preferenceScoresToSummary(scores: PreferenceScores): string {
  const parts: string[] = []
  for (const [cat, opts] of Object.entries(scores)) {
    if (!opts || typeof opts !== 'object') continue
    const top = Object.entries(opts)
      .filter(([, v]) => typeof v === 'number')
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')
    if (top) parts.push(`${cat}: ${top}`)
  }
  return parts.join('; ')
}

/** Short guidance for content length, engagement, and math presentation (for videos/written content). */
export function preferenceScoresToContentGuidance(scores: PreferenceScores): string {
  const parts: string[] = []
  const ws = scores.workingStyle
  if (ws && typeof ws === 'object') {
    const high = (key: string) => (typeof ws[key] === 'number' && (ws[key] as number) >= 4)
    if (high('shortBursts') || high('shortAttention') || high('needBreaks')) {
      parts.push('Prefer short segments and punchy engagement; avoid long blocks.')
    }
    if (high('longSessions') || high('longAttention') || high('marathon')) {
      parts.push('Can handle longer, sustained content and deep dives.')
    }
  }
  const mc = scores.mathContentPreference
  if (mc && typeof mc === 'object') {
    const top = Object.entries(mc)
      .filter(([, v]) => typeof v === 'number')
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 2)
    if (top.length) {
      parts.push(`Present math via: ${top.map(([k]) => k).join(' and ')}.`)
    }
  }
  const goal = scores.learningGoal
  if (goal && typeof goal === 'object') {
    const top = Object.entries(goal)
      .filter(([, v]) => typeof v === 'number')
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 1)
    if (top.length && (top[0][1] as number) >= 4) {
      const g = top[0][0]
      const labels: Record<string, string> = {
        understandMethods: 'deep understanding',
        learnMore: 'breadth of topics',
        passExams: 'exam readiness',
        improveBasics: 'solid basics',
        applications: 'real-world use',
        research: 'research/preparation',
      }
      parts.push(`Primary goal: ${labels[g] ?? g}.`)
    }
  }
  const approach = scores.learningApproach
  if (approach && typeof approach === 'object') {
    const top = Object.entries(approach)
      .filter(([, v]) => typeof v === 'number')
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 1)
    if (top.length && (top[0][1] as number) >= 4) {
      const a = top[0][0]
      const labels: Record<string, string> = {
        procedural: 'procedural (step-by-step build-up)',
        holistic: 'holistic (big picture first)',
        spiral: 'spiral (revisit at deeper levels)',
        linear: 'linear (one pass in order)',
      }
      parts.push(`Prefers ${labels[a] ?? a}.`)
    }
  }
  return parts.join(' ')
}
