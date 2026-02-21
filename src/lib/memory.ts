import { auth } from './firebase'
import { getUserMetadata, updateMemoryInFirestore, metadataToAgentContextString } from './firebaseMetadata'
import { metadataToAgentMemory } from './firebaseMetadata'
import type { AgentMemory, UserMetadata } from '../../shared/types'

export async function getMemory(): Promise<AgentMemory> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  const meta = await getUserMetadata(uid)
  if (!meta) throw new Error('User metadata not found')
  return metadataToAgentMemory(uid, meta)
}

/** Full metadata + context string for AI. Use in every agent call. */
export async function getMetadataForAgent(): Promise<{ meta: UserMetadata; contextString: string } | null> {
  const uid = auth.currentUser?.uid
  if (!uid) return null
  const meta = await getUserMetadata(uid)
  if (!meta) return null
  return { meta, contextString: metadataToAgentContextString(meta) }
}

export async function updateMemory(data: {
  topicsCovered?: string[]
  weaknesses?: string[]
  solveSummaries?: string[]
}): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  await updateMemoryInFirestore(uid, data)
}
