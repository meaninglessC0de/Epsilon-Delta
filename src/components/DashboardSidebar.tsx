import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getSolves } from '../lib/storage'
import type { User } from '../types'

const FAMOUS_MATHEMATICIANS = [
  'Euler', 'Gauss', 'Riemann', 'Fermat', 'Pascal', 'Descartes', 'Leibniz', 'Newton',
  'Archimedes', 'Euclid', 'Pythagoras', 'Hypatia', 'Cantor', 'Noether', 'Lovelace',
  'Turing', 'Shannon', 'Gödel', 'Poincaré', 'Ramanujan', 'Laplace', 'Lagrange',
  'Cauchy', 'Bernoulli', 'Galois', 'Abel', 'Diophantus', 'al-Khwarizmi', 'Bhaskara',
  'Kovalevskaya', 'Germain', 'Dedekind', 'Hilbert', 'Kolmogorov', 'von Neumann',
]

function getMathematicianForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash << 5) - hash + userId.charCodeAt(i)
  return FAMOUS_MATHEMATICIANS[Math.abs(hash) % FAMOUS_MATHEMATICIANS.length]
}

interface Props {
  user: User
  onNewProblem: () => void
  onOpenChat: () => void
  onGenerateVideo: () => void
  onOpenProfile?: () => void
}

export function DashboardSidebar({ user, onNewProblem, onOpenChat, onGenerateVideo, onOpenProfile }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [pastCount, setPastCount] = useState(0)

  const pathname = location.pathname
  const searchParams = new URLSearchParams(location.search)
  const view = searchParams.get('view')

  const mathematician = getMathematicianForUser(user.id)

  const isOverview = pathname === '/' && view !== 'past-solves'
  const isPastSolves = pathname === '/' && view === 'past-solves'
  const isNewProblem = pathname === '/new'
  const isChat = pathname === '/chat'
  const isManim = pathname === '/manim'
  const isProfile = pathname === '/profile'

  useEffect(() => {
    getSolves()
      .then((solves) => {
        const completed = solves.filter((s) => s.status === 'completed')
        const standalone = completed.filter((s) => !s.groupId).length
        const groupIds = new Set(completed.filter((s) => s.groupId).map((s) => s.groupId))
        setPastCount(standalone + groupIds.size)
      })
      .catch(() => {})
  }, [pathname])

  return (
    <aside className="dashboard-sidebar">
      <nav className="dashboard-nav">
        <button
          className={`dashboard-nav__item ${isOverview ? 'dashboard-nav__item--active' : ''}`}
          onClick={() => navigate('/')}
        >
          <span className="dashboard-nav__icon">🏠</span>
          <span>Overview</span>
        </button>
        <button
          className={`dashboard-nav__item dashboard-nav__item--action ${isNewProblem ? 'dashboard-nav__item--active' : ''}`}
          onClick={onNewProblem}
        >
          <span className="dashboard-nav__icon">✏️</span>
          <span>New problem</span>
          <span className="dashboard-nav__arrow">→</span>
        </button>
        <button
          className={`dashboard-nav__item dashboard-nav__item--action ${isChat ? 'dashboard-nav__item--active' : ''}`}
          onClick={onOpenChat}
        >
          <span className="dashboard-nav__icon">💬</span>
          <span>Talk to {mathematician}</span>
          <span className="dashboard-nav__arrow">→</span>
        </button>
        <button
          className={`dashboard-nav__item dashboard-nav__item--action ${isManim ? 'dashboard-nav__item--active' : ''}`}
          onClick={onGenerateVideo}
        >
          <span className="dashboard-nav__icon">🎬</span>
          <span>Video explanation</span>
          <span className="dashboard-nav__arrow">→</span>
        </button>
        <button
          className={`dashboard-nav__item ${isPastSolves ? 'dashboard-nav__item--active' : ''}`}
          onClick={() => navigate('/?view=past-solves')}
        >
          <span className="dashboard-nav__icon">📋</span>
          <span>Past solves</span>
          {pastCount > 0 && <span className="dashboard-nav__badge">{pastCount}</span>}
        </button>
        {onOpenProfile && (
          <button
            className={`dashboard-nav__item dashboard-nav__item--action ${isProfile ? 'dashboard-nav__item--active' : ''}`}
            onClick={onOpenProfile}
          >
            <span className="dashboard-nav__icon">👤</span>
            <span>Profile</span>
            <span className="dashboard-nav__arrow">→</span>
          </button>
        )}
      </nav>
    </aside>
  )
}
