import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import { DashboardPage } from './components/DashboardPage'
import { NewProblemPage } from './components/NewProblemPage'
import { WhiteboardPage } from './components/WhiteboardPage'
import { AuthPage } from './components/AuthPage'
import { AppNavbar } from './components/AppNavbar'
import { OnboardingFlow } from './components/onboarding/OnboardingFlow'
import type { Solve, User } from './types'
import { saveSolve, getSolveById, initStorage } from './lib/storage'
import { subscribeToAuth, clearToken } from './lib/auth'

// --- Auth: always default to login. User is set only after explicit Sign in / Sign up (not from persisted session). ---
type AuthState = { user: User | null; onboardingComplete: boolean }

function useAuth(): AuthState & { setAuth: (s: AuthState) => void } {
  const [state, setState] = useState<AuthState>({ user: null, onboardingComplete: false })

  useEffect(() => {
    const unsub = subscribeToAuth((fbUser, _onboardingComplete) => {
      // Only clear state when Firebase says logged out (e.g. logout in another tab). Never set user from Firebase on load.
      if (!fbUser) setState({ user: null, onboardingComplete: false })
    })
    return unsub
  }, [])

  return { ...state, setAuth: setState }
}

// --- Screens (no loading screen for auth). ---
function AppShell({
  user,
  onLogout,
  onHome,
  children,
}: {
  user: User
  onLogout: () => void
  onHome: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <AppNavbar user={user} onLogout={onLogout} onHome={onHome} />
      {children}
    </>
  )
}

function SolveScreen({ onFinish }: { onFinish: () => void }) {
  const { solveId } = useParams()
  const navigate = useNavigate()
  const [solve, setSolve] = useState<Solve | null>(null)

  useEffect(() => {
    if (!solveId) return
    let cancelled = false
    getSolveById(solveId).then((s) => {
      if (!cancelled) setSolve(s ?? null)
    })
    return () => { cancelled = true }
  }, [solveId])

  const goHome = useCallback(() => {
    onFinish()
    navigate('/', { replace: true })
  }, [navigate, onFinish])

  if (!solveId || !solve) return <Navigate to="/" replace />
  return <WhiteboardPage solve={solve} onFinish={goHome} />
}

// --- Router: one place that reads auth and renders the right screen. ---
function AppRoutes() {
  const { user, onboardingComplete, setAuth } = useAuth()
  const navigate = useNavigate()

  const onAuthSuccess = useCallback((data: { user: User; onboardingComplete: boolean }) => {
    initStorage(data.user.id)
    setAuth({ user: data.user, onboardingComplete: data.onboardingComplete })
    if (data.onboardingComplete) navigate('/', { replace: true })
    else navigate('/onboarding', { replace: true })
  }, [navigate, setAuth])

  const onOnboardingComplete = useCallback(() => {
    if (user) setAuth({ user, onboardingComplete: true })
    navigate('/', { replace: true })
  }, [navigate, setAuth, user])

  const onLogout = useCallback(() => {
    clearToken()
    setAuth({ user: null, onboardingComplete: false })
    navigate('/login', { replace: true })
  }, [navigate, setAuth])

  const goHome = useCallback(() => navigate('/', { replace: true }), [navigate])
  const goNew = useCallback(() => navigate('/new', { replace: true }), [navigate])
  const goSolve = useCallback((id: string) => navigate(`/solve/${id}`, { replace: true }), [navigate])

  const startSolve = useCallback(async (problem: string, problemImage?: string) => {
    const solve: Solve = {
      id: crypto.randomUUID(),
      problem,
      problemImage,
      createdAt: Date.now(),
      feedbackHistory: [],
      status: 'active',
    }
    await saveSolve(solve)
    navigate(`/solve/${solve.id}`, { replace: true })
  }, [navigate])

  // Not logged in → show login (any route)
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage onSuccess={onAuthSuccess} />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Logged in, onboarding not done → onboarding only
  if (!onboardingComplete) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingFlow user={user} onComplete={onOnboardingComplete} />} />
        <Route path="/onboarding/:stepIndex" element={<OnboardingFlow user={user} onComplete={onOnboardingComplete} />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    )
  }

  // Logged in, onboarding done → app
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppShell user={user} onLogout={onLogout} onHome={goHome}>
            <DashboardPage user={user} onNewProblem={goNew} onResumeSolve={goSolve} />
          </AppShell>
        }
      />
      <Route
        path="/new"
        element={
          <AppShell user={user} onLogout={onLogout} onHome={goHome}>
            <NewProblemPage onBack={goHome} onContinue={startSolve} />
          </AppShell>
        }
      />
      <Route path="/solve/:solveId" element={<SolveScreen onFinish={goHome} />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
