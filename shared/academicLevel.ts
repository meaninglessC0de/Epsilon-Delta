/**
 * Academic level (smartness) rating algorithm.
 * Uses study level, courses taken, institution, and math topic depth to produce
 * a 0–100 score and breakdown. Heavily weighted and normalized.
 */

/** Input slice needed to compute academic level */
export interface AcademicLevelInput {
  studyLevel?: string
  courses?: string[]
  university?: string
  mathTopics?: string[]
}

/** Sub-scores 0–100 each */
export interface AcademicLevelBreakdown {
  studyLevel: number
  courseLoad: number
  institution: number
  topicDepth: number
}

export interface AcademicLevelResult {
  academicLevel: number
  academicLevelBreakdown: AcademicLevelBreakdown
}

const STUDY_LEVEL_WEIGHT: Record<string, number> = {
  undergraduate: 28,
  postgraduate: 62,
  other: 18,
  phd: 85,
  masters: 58,
  bachelor: 30,
}

/** Max raw score for course load (then normalized to 0–100) */
const COURSE_LOAD_MAX = 8
const COURSE_LOAD_SCORE_PER_COURSE = 12

/** Institution tier keywords (partial match on normalized name) → bonus 0–30 */
const INSTITUTION_TIER_KEYWORDS: { keywords: string[]; bonus: number }[] = [
  { keywords: ['mit', 'stanford', 'harvard', 'caltech', 'princeton', 'oxford', 'cambridge', 'eth zurich', 'imperial college'], bonus: 30 },
  { keywords: ['berkeley', 'ucla', 'yale', 'columbia', 'chicago', 'cornell', 'upenn', 'duke', 'northwestern', 'johns hopkins'], bonus: 26 },
  { keywords: ['carnegie mellon', 'georgia tech', 'michigan', 'toronto', 'ucl', 'edinburgh', 'melbourne', 'sydney', 'national university singapore', 'hong kong'], bonus: 22 },
  { keywords: ['iit ', 'indian institute of technology', 'bits pilani', 'tsinghua', 'beijing', 'tokyo', 'kyoto', 'seoul national', 'delft', 'tu munich'], bonus: 20 },
  { keywords: ['university of', 'college', 'institute', 'school of'], bonus: 10 },
]

/** Advanced topics (higher weight for topic depth) */
const ADVANCED_TOPICS = new Set([
  'real_analysis', 'abstract_algebra', 'topology', 'complex_analysis',
  'differential_equations', 'optimization', 'number_theory',
])
const ADVANCED_TOPIC_POINTS = 14
const STANDARD_TOPIC_POINTS = 6
const TOPIC_DEPTH_MAX_RAW = 100

function normalizeForMatch(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Study level score 0–100 */
function scoreStudyLevel(studyLevel?: string): number {
  if (!studyLevel || !studyLevel.trim()) return 20
  const key = studyLevel.toLowerCase().trim()
  for (const [k, v] of Object.entries(STUDY_LEVEL_WEIGHT)) {
    if (key.includes(k)) return Math.min(100, v)
  }
  return 25
}

/** Course load score 0–100 (number and breadth of courses) */
function scoreCourseLoad(courses?: string[]): number {
  const n = Array.isArray(courses) ? courses.length : 0
  if (n === 0) return 5
  const raw = Math.min(COURSE_LOAD_MAX * COURSE_LOAD_SCORE_PER_COURSE, n * COURSE_LOAD_SCORE_PER_COURSE)
  return Math.min(100, Math.round((raw / (COURSE_LOAD_MAX * COURSE_LOAD_SCORE_PER_COURSE)) * 100))
}

/** Institution score 0–100 (reputation tier + base) */
function scoreInstitution(university?: string): number {
  if (!university || !university.trim()) return 35
  const norm = normalizeForMatch(university)
  let best = 50
  for (const { keywords, bonus } of INSTITUTION_TIER_KEYWORDS) {
    for (const kw of keywords) {
      if (norm.includes(kw)) {
        best = Math.max(best, Math.min(100, 50 + bonus))
        break
      }
    }
  }
  return best
}

/** Topic depth score 0–100 (advanced vs standard math topics) */
function scoreTopicDepth(mathTopics?: string[]): number {
  const topics = Array.isArray(mathTopics) ? mathTopics : []
  if (topics.length === 0) return 10
  let raw = 0
  for (const t of topics) {
    const key = (t || '').toLowerCase().trim()
    if (ADVANCED_TOPICS.has(key)) raw += ADVANCED_TOPIC_POINTS
    else raw += STANDARD_TOPIC_POINTS
  }
  const normalized = Math.min(100, Math.round((raw / TOPIC_DEPTH_MAX_RAW) * 100))
  return Math.min(100, normalized)
}

const WEIGHT_STUDY = 0.28
const WEIGHT_COURSE = 0.25
const WEIGHT_INSTITUTION = 0.27
const WEIGHT_TOPIC = 0.2

/**
 * Compute academic level (0–100) and breakdown from metadata.
 * Used when saving profile/onboarding so the value is stored in Firestore.
 */
export function computeAcademicLevel(input: AcademicLevelInput): AcademicLevelResult {
  const studyLevel = scoreStudyLevel(input.studyLevel)
  const courseLoad = scoreCourseLoad(input.courses)
  const institution = scoreInstitution(input.university)
  const topicDepth = scoreTopicDepth(input.mathTopics)

  const weighted =
    studyLevel * WEIGHT_STUDY +
    courseLoad * WEIGHT_COURSE +
    institution * WEIGHT_INSTITUTION +
    topicDepth * WEIGHT_TOPIC

  const academicLevel = Math.round(Math.max(0, Math.min(100, weighted)))

  return {
    academicLevel,
    academicLevelBreakdown: { studyLevel, courseLoad, institution, topicDepth },
  }
}
