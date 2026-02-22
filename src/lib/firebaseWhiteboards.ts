import { doc, getDoc, setDoc, getFirestore, type Firestore } from 'firebase/firestore'
import type { WhiteboardState } from '../../shared/types'
import { db } from './firebase'

/**
 * Whiteboard document stored at users/{uid}/whiteboards/{solveId}.
 * All whiteboard data lives here; resume loads from this collection when solve is not completed.
 */
export interface WhiteboardDoc {
  /** Who created/owns this whiteboard (redundant with path; useful for queries). */
  userId: string
  /** Solve this whiteboard belongs to. */
  solveId: string
  /** Full Excalidraw scene (JSON string; Firestore does not support nested arrays). */
  whiteboardState: string
  createdAt: number
  updatedAt: number
}

function whiteboardDocRef(uid: string, solveId: string, firestore?: Firestore) {
  const d = firestore ?? db
  return doc(d, 'users', uid, 'whiteboards', solveId)
}

function parseWhiteboardState(json: string): WhiteboardState | null {
  try {
    const parsed = JSON.parse(json) as WhiteboardState
    if (parsed && Array.isArray(parsed.elements) && parsed.appState && typeof parsed.appState === 'object') {
      return parsed
    }
  } catch {
    /* ignore */
  }
  return null
}

export async function getWhiteboardFromFirestore(
  uid: string,
  solveId: string,
  firestore?: Firestore
): Promise<WhiteboardState | null> {
  const ref = whiteboardDocRef(uid, solveId, firestore)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data() as Record<string, unknown>
  const raw = data.whiteboardState
  if (typeof raw !== 'string') return null
  return parseWhiteboardState(raw)
}

export async function saveWhiteboardToFirestore(
  uid: string,
  solveId: string,
  whiteboardState: WhiteboardState,
  firestore?: Firestore
): Promise<void> {
  const ref = whiteboardDocRef(uid, solveId, firestore)
  const now = Date.now()
  const existing = await getDoc(ref)
  const createdAt = existing.exists() ? (existing.data() as Record<string, unknown>).createdAt as number : now
  const doc: WhiteboardDoc = {
    userId: uid,
    solveId,
    whiteboardState: JSON.stringify(whiteboardState),
    createdAt,
    updatedAt: now,
  }
  await setDoc(ref, doc, { merge: true })
}
