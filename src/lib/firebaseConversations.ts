import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  type Firestore,
} from 'firebase/firestore'
import { db } from './firebase'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StoredConversation {
  id: string
  messages: ConversationMessage[]
  createdAt: number
  endedAt: number
}

function conversationsCollection(uid: string, firestore?: Firestore) {
  const d = firestore ?? db
  return collection(d, 'users', uid, 'conversations')
}

/** Save a completed tutor conversation when the user ends it. */
export async function saveConversationToFirestore(
  uid: string,
  messages: ConversationMessage[],
  firestore?: Firestore
): Promise<void> {
  const col = conversationsCollection(uid, firestore)
  const now = Date.now()
  await addDoc(col, {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    createdAt: now,
    endedAt: now,
  })
}

/** Get recent conversations for context. Returns most recent first, up to 5. */
export async function getRecentConversationsFromFirestore(
  uid: string,
  limitCount: number = 5,
  firestore?: Firestore
): Promise<StoredConversation[]> {
  const col = conversationsCollection(uid, firestore)
  const q = query(col, orderBy('endedAt', 'desc'), limit(limitCount))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as { messages?: { role: string; content: string }[]; createdAt?: number; endedAt?: number }
    const messages: ConversationMessage[] = Array.isArray(data.messages)
      ? data.messages
          .filter((m) => m && typeof m.role === 'string' && typeof m.content === 'string')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : []
    return {
      id: d.id,
      messages,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
      endedAt: typeof data.endedAt === 'number' ? data.endedAt : 0,
    }
  })
}
