import { apiGet, apiPost, apiPut } from './api'
import type { AuthResponse, MeResponse } from '../../shared/types'

const TOKEN_KEY = 'auth_token'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export async function register(email: string, password: string, name?: string): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/auth/register', { email, password, name })
  storeToken(data.token)
  return data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/auth/login', { email, password })
  storeToken(data.token)
  return data
}

export function logout(): void {
  clearToken()
}

export async function getMe(): Promise<MeResponse> {
  return apiGet<MeResponse>('/auth/me')
}

export async function updateProfile(data: {
  university?: string
  studyLevel?: string
  courses?: string[]
  learningPrefs?: Record<string, boolean>
}): Promise<void> {
  await apiPut('/profile', data)
}
