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
import type { Solve, FeedbackEntry } from '../../shared/types'
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
  return {
    id,
    problem: (data.problem as string) ?? '',
    problemImage: data.problemImage as string | undefined,
    createdAt: (data.createdAt as number) ?? 0,
    completedAt: data.completedAt as number | undefined,
    finalWorking: data.finalWorking as string | undefined,
    finalFeedback: data.finalFeedback as string | undefined,
    feedbackHistory: Array.isArray(data.feedbackHistory) ? (data.feedbackHistory as FeedbackEntry[]) : [],
    status: (data.status as 'active' | 'completed') ?? 'active',
  }
}

function solveToFirestore(solve: Solve): Record<string, unknown> {
  return {
    id: solve.id,
    problem: solve.problem,
    problemImage: solve.problemImage ?? null,
    createdAt: solve.createdAt,
    completedAt: solve.completedAt ?? null,
    finalWorking: solve.finalWorking ?? null,
    finalFeedback: solve.finalFeedback ?? null,
    feedbackHistory: solve.feedbackHistory,
    status: solve.status,
  }
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
