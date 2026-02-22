import { auth } from './firebase'
import {
  getSolvesFromFirestore,
  getSolveByIdFromFirestore,
  saveSolveToFirestore,
  deleteSolveFromFirestore,
} from './firebaseSolves'
import {
  getWhiteboardFromFirestore,
  saveWhiteboardToFirestore,
} from './firebaseWhiteboards'
import type { Solve, WhiteboardState } from '../types'

const BASE_KEY = 'epsilon_delta_solves_v1'

/** No-op for Firebase; storage is keyed by current user. Kept for API compatibility. */
export function initStorage(_userId: string): void {
  // Firebase uses auth.currentUser.uid; no need to set a key.
}

export async function getSolves(): Promise<Solve[]> {
  const uid = auth.currentUser?.uid
  if (!uid) return []
  return getSolvesFromFirestore(uid)
}

export async function getSolveById(id: string): Promise<Solve | null> {
  const uid = auth.currentUser?.uid
  if (!uid) return null
  return getSolveByIdFromFirestore(uid, id)
}

/** Returns solves in the same group, sorted by questionIndex. */
export async function getSolvesByGroupId(groupId: string): Promise<Solve[]> {
  const all = await getSolves()
  return all.filter((s) => s.groupId === groupId).sort((a, b) => (a.questionIndex ?? 0) - (b.questionIndex ?? 0))
}

export async function saveSolve(solve: Solve): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return
  await saveSolveToFirestore(solve, uid)
}

export async function deleteSolve(id: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return
  await deleteSolveFromFirestore(uid, id)
}

/** Fetch whiteboard data for a solve from the whiteboards collection (for resume when solve is not completed). */
export async function getWhiteboard(solveId: string): Promise<WhiteboardState | null> {
  const uid = auth.currentUser?.uid
  if (!uid) return null
  return getWhiteboardFromFirestore(uid, solveId)
}

/** Save whiteboard data to the whiteboards collection (who made it is implied by auth). */
export async function saveWhiteboard(solveId: string, whiteboardState: WhiteboardState): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return
  await saveWhiteboardToFirestore(uid, solveId, whiteboardState)
}

/** One-time: read legacy localStorage key and return solves if present (for migration). */
export function getLegacySolvesFromLocalStorage(): Solve[] | null {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(BASE_KEY + '_u')) keys.push(k)
    }
    if (keys.length === 0) return null
    const raw = localStorage.getItem(keys[0])
    if (!raw) return null
    const parsed = JSON.parse(raw) as Solve[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Remove legacy solve key from localStorage after migration. */
export function clearLegacySolvesFromLocalStorage(): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(BASE_KEY + '_u')) keys.push(k)
  }
  keys.forEach((k) => localStorage.removeItem(k))
}
