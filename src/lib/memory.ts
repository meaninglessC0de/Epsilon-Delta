import { apiGet, apiPut } from './api'
import type { AgentMemory } from '../../shared/types'

export async function getMemory(): Promise<AgentMemory> {
  return apiGet<AgentMemory>('/memory')
}

export async function updateMemory(data: {
  topicsCovered?: string[]
  weaknesses?: string[]
  solveSummaries?: string[]
}): Promise<void> {
  await apiPut('/memory', data)
}
