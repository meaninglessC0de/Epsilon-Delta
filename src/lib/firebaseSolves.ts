import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  getFirestore,
  type Firestore,
} from 'firebase/firestore'
import type { Solve, FeedbackEntry, WhiteboardState } from '../../shared/types'
import { db } from './firebase'

function solvesCollection(uid: string, firestore?: Firestore) {
  const d = firestore ?? db
  return collection(d, 'users', uid, 'solves')
}

function solveDoc(uid: string, solveId: string, firestore?: Firestore) {
  const d = firestore ?? db
  return doc(d, 'users', uid, 'solves', solveId)
}

function firestoreToSolve(id: string, data: Record<string, unknown>): Solve {
  let whiteboardState: WhiteboardState | undefined
  const ws = data.whiteboardState
  if (typeof ws === 'string') {
    try {
      const parsed = JSON.parse(ws) as WhiteboardState
      if (parsed && Array.isArray(parsed.elements)) whiteboardState = parsed
    } catch {
      /* ignore */
    }
  } else if (ws && typeof ws === 'object' && Array.isArray((ws as Record<string, unknown>).elements)) {
    whiteboardState = ws as WhiteboardState
  }
  return {
    id,
    problem: (data.problem as string) ?? '',
    problemImage: data.problemImage as string | undefined,
    createdAt: (data.createdAt as number) ?? 0,
    completedAt: data.completedAt as number | undefined,
    finalWorking: data.finalWorking as string | undefined,
    finalFeedback: data.finalFeedback as string | undefined,
    feedbackHistory: Array.isArray(data.feedbackHistory) ? (data.feedbackHistory as FeedbackEntry[]) : [],
    status: (data.status as 'active' | 'completed' | 'incorrect') ?? 'active',
    groupId: data.groupId as string | undefined,
    questionIndex: data.questionIndex as number | undefined,
    questionCount: data.questionCount as number | undefined,
    sheetTitle: data.sheetTitle as string | undefined,
    whiteboardState,
  }
}

/** Recursively strip undefined (Firestore disallows it). Omit undefined keys; undefined in arrays becomes null. */
function stripUndefined<T>(value: T): T {
  if (value === undefined) return null as T
  if (Array.isArray(value)) return value.map(stripUndefined) as T
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = stripUndefined(v)
    }
    return out as T
  }
  return value
}

function solveToFirestore(solve: Solve): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    id: solve.id,
    problem: solve.problem,
    problemImage: solve.problemImage ?? null,
    createdAt: solve.createdAt,
    completedAt: solve.completedAt ?? null,
    finalWorking: solve.finalWorking ?? null,
    finalFeedback: solve.finalFeedback ?? null,
    feedbackHistory: solve.feedbackHistory,
    status: solve.status,
    groupId: solve.groupId ?? null,
    questionIndex: solve.questionIndex ?? null,
    questionCount: solve.questionCount ?? null,
    sheetTitle: solve.sheetTitle ?? null,
    whiteboardState: solve.whiteboardState ? JSON.stringify(solve.whiteboardState) : null,
  }
  return stripUndefined(raw) as Record<string, unknown>
}

export async function getSolvesFromFirestore(uid: string, firestore?: Firestore): Promise<Solve[]> {
  const col = solvesCollection(uid, firestore)
  const q = query(col, orderBy('createdAt', 'desc'), limit(500))
  const snap = await getDocs(q)
  return snap.docs.map((d) => firestoreToSolve(d.id, d.data() as Record<string, unknown>))
}

export async function getSolveByIdFromFirestore(
  uid: string,
  solveId: string,
  firestore?: Firestore
): Promise<Solve | null> {
  const ref = solveDoc(uid, solveId, firestore)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return firestoreToSolve(snap.id, snap.data() as Record<string, unknown>)
}

export async function saveSolveToFirestore(solve: Solve, uid: string, firestore?: Firestore): Promise<void> {
  const ref = solveDoc(uid, solve.id, firestore)
  await setDoc(ref, solveToFirestore(solve), { merge: true })
}

export async function deleteSolveFromFirestore(
  uid: string,
  solveId: string,
  firestore?: Firestore
): Promise<void> {
  const ref = solveDoc(uid, solveId, firestore)
  await deleteDoc(ref)
}
