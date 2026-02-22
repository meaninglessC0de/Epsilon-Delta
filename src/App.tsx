import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import { DashboardPage } from './components/DashboardPage'
import { ChatPage } from './components/ChatPage'
import { ManimPage } from './components/ManimPage'
import { ProfilePage } from './components/ProfilePage'
import { ThemeToggle } from './lib/theme'
import { NewProblemPage } from './components/NewProblemPage'
import { WhiteboardPage } from './components/WhiteboardPage'
import { AuthPage } from './components/AuthPage'
import { AppNavbar } from './components/AppNavbar'
import { AppShellWithSidebar } from './components/AppShellWithSidebar'
import { OnboardingFlow } from './components/onboarding/OnboardingFlow'
import { DevelopmentProgressProvider } from './lib/developmentProgressToast'
import type { Solve, User } from './types'
import { saveSolve, getSolveById, initStorage } from './lib/storage'
import { subscribeToAuth, clearToken } from './lib/auth'

// --- Auth: restore from local session when user has logged in on this device; otherwise show login. ---
type AuthState = { user: User | null; onboardingComplete: boolean; authReady: boolean }

function useAuth(): AuthState & { setAuth: (s: Partial<AuthState>) => void } {
  const [state, setState] = useState<AuthState>({ user: null, onboardingComplete: false, authReady: false })

  useEffect(() => {
    const unsub = subscribeToAuth((user, onboardingComplete) => {
      setState((prev) => ({
        user: user ?? null,
        onboardingComplete: user ? onboardingComplete : false,
        authReady: true,
      }))
    })
    return unsub
  }, [])

  const setAuth = useCallback((next: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...next }))
  }, [])

  return { ...state, setAuth }
}

function useInitStorageOnUser(user: User | null) {
  useEffect(() => {
    if (user) initStorage(user.id)
  }, [user?.id])
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
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!solveId) {
      setLoaded(true)
      return
    }
    let cancelled = false
    getSolveById(solveId)
      .then((s) => {
        if (!cancelled) setSolve(s ?? null)
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => { cancelled = true }
  }, [solveId])

  const goHome = useCallback(() => {
    onFinish()
    navigate('/', { replace: true })
  }, [navigate, onFinish])

  if (!solveId) return <Navigate to="/" replace />
  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'column', gap: '12px' }}>
        <div className="solve-loading-spinner" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%' }} />
        <p style={{ color: 'var(--text-2)', fontSize: '0.95rem' }}>Opening whiteboard…</p>
      </div>
    )
  }
  if (!solve) return <Navigate to="/" replace />
  return <WhiteboardPage solve={solve} onFinish={goHome} />
}

// --- Router: one place that reads auth and renders the right screen. ---
function AppRoutes() {
  const { user, onboardingComplete, authReady, setAuth } = useAuth()
  const navigate = useNavigate()

  useInitStorageOnUser(user)

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
  const goManim = useCallback(() => navigate('/manim', { replace: true }), [navigate])
  const goChat = useCallback(() => navigate('/chat', { replace: true }), [navigate])

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

  const startSheet = useCallback(
    async (
      questions: { problem: string; problemImage?: string }[],
      sheetImageBase64?: string,
      sheetTitle?: string,
    ) => {
      const groupId = crypto.randomUUID()
      const createdAt = Date.now()
      const N = questions.length
      const solves: Solve[] = questions.map((q, i) => ({
        id: crypto.randomUUID(),
        problem: q.problem,
        problemImage: q.problemImage,
        createdAt,
        feedbackHistory: [],
        status: 'active',
        groupId,
        questionIndex: i,
        questionCount: N,
        sheetTitle: sheetTitle ?? undefined,
      }))
      for (const s of solves) await saveSolve(s)
      navigate(`/solve/${solves[0].id}`, { replace: true })
    },
    [navigate],
  )

  // Auth not yet restored from local session → show brief loading
  if (!authReady) {
    return (
      <div className="auth-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'column', gap: '12px' }}>
        <div className="solve-loading-spinner" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%' }} />
        <p style={{ color: 'var(--text-2)', fontSize: '0.95rem' }}>Checking sign-in…</p>
      </div>
    )
  }

  // Not logged in → show login (any route)
  if (!user) {
    return (
      <>
        <ThemeToggle />
        <Routes>
        <Route path="/login" element={<AuthPage onSuccess={onAuthSuccess} />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </>
    )
  }

  // Logged in, onboarding not done → onboarding only
  if (!onboardingComplete) {
    return (
      <>
        <ThemeToggle />
        <Routes>
        <Route path="/onboarding" element={<OnboardingFlow user={user} onComplete={onOnboardingComplete} />} />
        <Route path="/onboarding/:stepIndex" element={<OnboardingFlow user={user} onComplete={onOnboardingComplete} />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
      </>
    )
  }

  // Logged in, onboarding done → app (navbar + sidebar + pocket)
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppShellWithSidebar user={user} onLogout={onLogout} onHome={goHome} onNewProblem={goNew} onOpenChat={goChat} onGenerateVideo={goManim} onOpenProfile={() => navigate('/profile')}>
            <DashboardPage user={user} onNewProblem={goNew} onResumeSolve={goSolve} onGenerateVideo={goManim} onOpenChat={goChat} onOpenProfile={() => navigate('/profile')} />
          </AppShellWithSidebar>
        }
      />
      <Route
        path="/new"
        element={
          <AppShellWithSidebar user={user} onLogout={onLogout} onHome={goHome} onNewProblem={goNew} onOpenChat={goChat} onGenerateVideo={goManim} onOpenProfile={() => navigate('/profile')}>
            <NewProblemPage onBack={goHome} onContinue={startSolve} onContinueSheet={startSheet} />
          </AppShellWithSidebar>
        }
      />
      <Route path="/solve/:solveId" element={<SolveScreen onFinish={goHome} />} />
      <Route
        path="/chat"
        element={
          <AppShellWithSidebar user={user} onLogout={onLogout} onHome={goHome} onNewProblem={goNew} onOpenChat={goChat} onGenerateVideo={goManim} onOpenProfile={() => navigate('/profile')}>
            <ChatPage user={user} onBack={goHome} />
          </AppShellWithSidebar>
        }
      />
      <Route
        path="/manim"
        element={
          <AppShellWithSidebar user={user} onLogout={onLogout} onHome={goHome} onNewProblem={goNew} onOpenChat={goChat} onGenerateVideo={goManim} onOpenProfile={() => navigate('/profile')}>
            <ManimPage onBack={goHome} />
          </AppShellWithSidebar>
        }
      />
      <Route
        path="/profile"
        element={
          <AppShellWithSidebar user={user} onLogout={onLogout} onHome={goHome} onNewProblem={goNew} onOpenChat={goChat} onGenerateVideo={goManim} onOpenProfile={() => navigate('/profile')}>
            <ProfilePage user={user} onBack={goHome} />
          </AppShellWithSidebar>
        }
      />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <DevelopmentProgressProvider>
        <AppRoutes />
      </DevelopmentProgressProvider>
    </BrowserRouter>
  )
}
