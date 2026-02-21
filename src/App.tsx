import { useState, useCallback } from 'react'
import { SolvePage } from './components/SolvePage'
import { NewProblemPage } from './components/NewProblemPage'
import { WhiteboardPage } from './components/WhiteboardPage'
import type { Solve } from './types'
import { saveSolve, getSolveById } from './lib/storage'

type Page = 'solve-list' | 'new-problem' | 'whiteboard'

interface State {
  page: Page
  activeSolve?: Solve
}

export default function App() {
  const [state, setState] = useState<State>({ page: 'solve-list' })

  const goToSolveList = useCallback(() => {
    setState({ page: 'solve-list' })
  }, [])

  const goToNewProblem = useCallback(() => {
    setState({ page: 'new-problem' })
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

  if (state.page === 'solve-list') {
    return <SolvePage onNewProblem={goToNewProblem} onResumeSolve={resumeSolve} />
  }

  if (state.page === 'new-problem') {
    return <NewProblemPage onBack={goToSolveList} onContinue={startSolve} />
  }

  if (state.page === 'whiteboard' && state.activeSolve) {
    return <WhiteboardPage solve={state.activeSolve} onFinish={goToSolveList} />
  }

  return null
}
