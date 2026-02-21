import { useState, useCallback, useEffect } from 'react'
import { DashboardPage } from './components/DashboardPage'
import { ManimPage } from './components/ManimPage'
import { NewProblemPage } from './components/NewProblemPage'
import { WhiteboardPage } from './components/WhiteboardPage'
import { AuthPage } from './components/AuthPage'
import { AppNavbar } from './components/AppNavbar'
import { OnboardingPage } from './components/OnboardingPage'
import type { Solve, User } from './types'
import { saveSolve, getSolveById, initStorage } from './lib/storage'
import { getStoredToken, clearToken, getMe } from './lib/auth'

type Page = 'auth' | 'onboarding' | 'solve-list' | 'new-problem' | 'whiteboard' | 'manim'

interface State {
  page: Page
  activeSolve?: Solve
}

export default function App() {
  const [state, setState] = useState<State>({ page: 'solve-list' })
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      setState({ page: 'auth' })
      setAuthChecked(true)
      return
    }

    getMe()
      .then((data) => {
        initStorage(data.user.id)
        setUser(data.user)
        setState({ page: data.onboardingComplete ? 'solve-list' : 'onboarding' })
      })
      .catch(() => {
        clearToken()
        setState({ page: 'auth' })
      })
      .finally(() => setAuthChecked(true))
  }, [])

  const handleAuthSuccess = useCallback((data: { user: User; onboardingComplete: boolean }) => {
    initStorage(data.user.id)
    setUser(data.user)
    setState({ page: data.onboardingComplete ? 'solve-list' : 'onboarding' })
  }, [])

  const handleOnboardingComplete = useCallback(() => {
    setState({ page: 'solve-list' })
  }, [])

  const handleLogout = useCallback(() => {
    clearToken()
    setUser(null)
    setState({ page: 'auth' })
  }, [])

  const goToSolveList = useCallback(() => {
    setState({ page: 'solve-list' })
  }, [])

  const goToNewProblem = useCallback(() => {
    setState({ page: 'new-problem' })
  }, [])

  const goToManim = useCallback(() => {
    setState({ page: 'manim' })
  }, [])

  const startSolve = useCallback((problem: string, problemImage?: string) => {
    const solve: Solve = {
      id: crypto.randomUUID(),
      problem,
      problemImage,
      createdAt: Date.now(),
      feedbackHistory: [],
      status: 'active',
    }
    saveSolve(solve)
    setState({ page: 'whiteboard', activeSolve: solve })
  }, [])

  const resumeSolve = useCallback((solveId: string) => {
    const solve = getSolveById(solveId)
    if (solve) setState({ page: 'whiteboard', activeSolve: solve })
  }, [])

  if (!authChecked) return null

  if (state.page === 'auth') {
    return <AuthPage onSuccess={handleAuthSuccess} />
  }

  if (state.page === 'onboarding' && user) {
    return <OnboardingPage user={user} onComplete={handleOnboardingComplete} />
  }

  if (state.page === 'solve-list' && user) {
    return (
      <>
        <AppNavbar user={user} onLogout={handleLogout} onHome={goToSolveList} />
        <DashboardPage user={user} onNewProblem={goToNewProblem} onResumeSolve={resumeSolve} onGenerateVideo={goToManim} />
      </>
    )
  }

  if (state.page === 'manim') {
    return (
      <>
        <AppNavbar user={user} onLogout={handleLogout} onHome={goToSolveList} />
        <ManimPage onBack={goToSolveList} />
      </>
    )
  }

  if (state.page === 'new-problem') {
    return (
      <>
        <AppNavbar user={user} onLogout={handleLogout} onHome={goToSolveList} />
        <NewProblemPage onBack={goToSolveList} onContinue={startSolve} />
      </>
    )
  }

  if (state.page === 'whiteboard' && state.activeSolve) {
    return <WhiteboardPage solve={state.activeSolve} onFinish={goToSolveList} />
  }

  return null
}
