import { useState, useEffect } from 'react'
import { getSolves, deleteSolve } from '../lib/storage'
import { TutorCallModal } from './TutorCallModal'
import type { User, Solve } from '../types'

interface Props {
  user: User
  onNewProblem: () => void
  onResumeSolve: (id: string) => void
  onGenerateVideo: () => void
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(start: number, end?: number): string {
  const ms = (end ?? Date.now()) - start
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function SolveCard({
  solve,
  onDelete,
  onResume,
}: {
  solve: Solve
  onDelete: (id: string) => void
  onResume: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <article className="solve-card">
      {solve.finalWorking ? (
        <div className="solve-card__thumbnail">
          <img src={`data:image/jpeg;base64,${solve.finalWorking}`} alt="Final working" />
        </div>
      ) : (
        <div className="solve-card__thumbnail solve-card__thumbnail--empty">
          <span className="solve-card__thumbnail-icon">✏️</span>
        </div>
      )}

      <div className="solve-card__body">
        <div className="solve-card__meta">
          <span className={`solve-card__badge solve-card__badge--${solve.status}`}>
            {solve.status === 'completed' ? 'Completed' : 'In Progress'}
          </span>
          <span className="solve-card__date">{formatDate(solve.createdAt)}</span>
        </div>

        <p className="solve-card__problem">
          {solve.problem.length > 120 ? solve.problem.slice(0, 120) + '…' : solve.problem}
        </p>

        {solve.finalFeedback && (
          <p className="solve-card__feedback">
            {solve.finalFeedback.length > 100
              ? solve.finalFeedback.slice(0, 100) + '…'
              : solve.finalFeedback}
          </p>
        )}

        <div className="solve-card__footer">
          <span className="solve-card__stat">⏱ {formatDuration(solve.createdAt, solve.completedAt)}</span>
          <span className="solve-card__stat">
            💬 {solve.feedbackHistory.length} check{solve.feedbackHistory.length !== 1 ? 's' : ''}
          </span>

          <div className="solve-card__actions">
            {solve.status === 'active' && (
              <button className="btn btn--ghost btn--sm" onClick={() => onResume(solve.id)}>
                Resume
              </button>
            )}
            {confirmDelete ? (
              <>
                <button className="btn btn--danger btn--sm" onClick={() => onDelete(solve.id)}>
                  Confirm
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="btn btn--ghost btn--sm solve-card__delete"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export function DashboardPage({ user, onNewProblem, onResumeSolve, onGenerateVideo }: Props) {
  const [solves, setSolves] = useState<Solve[]>([])
  const [loading, setLoading] = useState(true)
  const [showCall, setShowCall] = useState(false)

  useEffect(() => {
    getSolves()
      .then(setSolves)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    await deleteSolve(id)
    setSolves(await getSolves())
  }

  const displayName = user.name ?? user.email.split('@')[0]
  const active = solves.filter((s) => s.status === 'active')
  const completed = solves.filter((s) => s.status === 'completed')

  return (
    <div className="dashboard-page">
      {/* Hero */}
      <section className="dashboard-hero">
        <h1 className="dashboard-greeting">
          {getGreeting()}, {displayName}.
        </h1>
        <div className="dashboard-stats">
          <span>{solves.length} problem{solves.length !== 1 ? 's' : ''} total</span>
          <span>·</span>
          <span>{completed.length} completed</span>
          {active.length > 0 && (
            <>
              <span>·</span>
              <span>{active.length} in progress</span>
            </>
          )}
        </div>

        {/* CTAs */}
        <div className="dashboard-ctas">
          <button className="btn btn--primary btn--lg" onClick={onNewProblem}>
            <span>Start a new problem</span>
            <span className="btn__arrow">→</span>
          </button>
          <button
            className="btn btn--ghost btn--lg"
            onClick={() => setShowCall(true)}
          >
            📞 Hop on a call
          </button>
          <button
            className="btn btn--ghost btn--lg"
            onClick={onGenerateVideo}
          >
            🎬 Video explanation
          </button>
        </div>
      </section>

      {/* Solve history */}
      <main className="solve-list-page__main">
        {loading ? (
          <div className="empty-state">
            <p className="empty-state__body">Loading…</p>
          </div>
        ) : solves.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📐</div>
            <h2 className="empty-state__title">No solves yet</h2>
            <p className="empty-state__body">
              Start your first problem above — your work and feedback will be saved here.
            </p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section className="solve-section">
                <h2 className="solve-section__title">In Progress</h2>
                <div className="solve-grid">
                  {active.map((s) => (
                    <SolveCard
                      key={s.id}
                      solve={s}
                      onDelete={handleDelete}
                      onResume={onResumeSolve}
                    />
                  ))}
                </div>
              </section>
            )}

            {completed.length > 0 && (
              <section className="solve-section">
                <h2 className="solve-section__title">Past Solves</h2>
                <div className="solve-grid">
                  {completed.map((s) => (
                    <SolveCard
                      key={s.id}
                      solve={s}
                      onDelete={handleDelete}
                      onResume={() => {}}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Tutor call modal */}
      {showCall && (
        <TutorCallModal
          user={user}
          solves={solves}
          onClose={() => setShowCall(false)}
        />
      )}
    </div>
  )
}
