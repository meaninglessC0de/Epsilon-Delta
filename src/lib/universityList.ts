/**
 * University list for onboarding. Uses a bundled list for instant load (no network).
 * Re-export type and filter for compatibility.
 */
import { BUNDLED_UNIVERSITIES, type UniversityEntry } from './bundledUniversities'

export type { UniversityEntry }

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

/** Returns the bundled list immediately (no fetch). */
export function getUniversityList(): Promise<UniversityEntry[]> {
  return Promise.resolve(BUNDLED_UNIVERSITIES)
}

export function filterUniversities(
  list: UniversityEntry[],
  query: string,
  max: number = 80
): UniversityEntry[] {
  if (!query.trim()) return list.slice(0, max)
  const q = normalize(query)
  const out: UniversityEntry[] = []
  for (const u of list) {
    if (out.length >= max) break
    if (normalize(u.name).includes(q) || normalize(u.country).includes(q)) out.push(u)
  }
  return out
}
