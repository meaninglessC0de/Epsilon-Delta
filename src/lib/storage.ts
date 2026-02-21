import type { Solve } from '../types'

const BASE_KEY = 'epsilon_delta_solves_v1'
let storageKey = BASE_KEY

export function initStorage(userId: number): void {
  storageKey = `${BASE_KEY}_u${userId}`
}

export function getSolves(): Solve[] {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as Solve[]) : []
  } catch {
    return []
  }
}

export function getSolveById(id: string): Solve | null {
  return getSolves().find((s) => s.id === id) ?? null
}

export function saveSolve(solve: Solve): void {
  const solves = getSolves()
  const idx = solves.findIndex((s) => s.id === solve.id)
  if (idx >= 0) {
    solves[idx] = solve
  } else {
    solves.unshift(solve)
  }
  localStorage.setItem(storageKey, JSON.stringify(solves))
}

export function deleteSolve(id: string): void {
  const solves = getSolves().filter((s) => s.id !== id)
  localStorage.setItem(storageKey, JSON.stringify(solves))
}
