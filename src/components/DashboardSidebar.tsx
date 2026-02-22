import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getSolves } from '../lib/storage'
import { getMathematicianForUser } from '../lib/mathematician'
import type { User } from '../types'

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
          <svg className="dashboard-nav__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <rect x="1" y="8" width="5" height="7" rx="1" /><rect x="10" y="4" width="5" height="11" rx="1" /><path d="M1 5.5 8 1l7 4.5" strokeLinejoin="round" />
          </svg>
          <span>Overview</span>
        </button>
        <button
          className={`dashboard-nav__item dashboard-nav__item--action ${isNewProblem ? 'dashboard-nav__item--active' : ''}`}
          onClick={onNewProblem}
        >
          <svg className="dashboard-nav__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M11 2.5a1.5 1.5 0 0 1 2.5 1.5L5 13l-3 .5.5-3L11 2.5z" strokeLinejoin="round" />
          </svg>
          <span>New problem</span>
          <span className="dashboard-nav__arrow">→</span>
        </button>
        <button
          className={`dashboard-nav__item dashboard-nav__item--action ${isChat ? 'dashboard-nav__item--active' : ''}`}
          onClick={onOpenChat}
        >
          <svg className="dashboard-nav__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M14 9.5a5 5 0 0 1-5 4H3l-1.5 1.5V9.5a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5z" strokeLinejoin="round" />
          </svg>
          <span>Talk to {mathematician}</span>
          <span className="dashboard-nav__arrow">→</span>
        </button>
        <button
          className={`dashboard-nav__item dashboard-nav__item--action ${isManim ? 'dashboard-nav__item--active' : ''}`}
          onClick={onGenerateVideo}
        >
          <svg className="dashboard-nav__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <rect x="1" y="3" width="10" height="10" rx="1.5" /><path d="M11 6l4-2v8l-4-2" strokeLinejoin="round" />
          </svg>
          <span>Video explanation</span>
          <span className="dashboard-nav__arrow">→</span>
        </button>
        <button
          className={`dashboard-nav__item ${isPastSolves ? 'dashboard-nav__item--active' : ''}`}
          onClick={() => navigate('/?view=past-solves')}
        >
          <svg className="dashboard-nav__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <rect x="2" y="2" width="12" height="12" rx="1.5" /><path d="M5 6h6M5 9h4" strokeLinecap="round" />
          </svg>
          <span>Past solves</span>
          {pastCount > 0 && <span className="dashboard-nav__badge">{pastCount}</span>}
        </button>
        {onOpenProfile && (
          <button
            className={`dashboard-nav__item dashboard-nav__item--action ${isProfile ? 'dashboard-nav__item--active' : ''}`}
            onClick={onOpenProfile}
          >
            <svg className="dashboard-nav__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <circle cx="8" cy="5" r="3" /><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" strokeLinecap="round" />
            </svg>
            <span>Profile</span>
            <span className="dashboard-nav__arrow">→</span>
          </button>
        )}
      </nav>
    </aside>
  )
}
