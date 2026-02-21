import { useState, useEffect } from 'react'
import type { Solve } from '../types'
import { getSolves, deleteSolve } from '../lib/storage'

interface Props {
  onNewProblem: () => void
  onResumeSolve: (solveId: string) => void
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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
      {solve.finalWorking && (
        <div className="solve-card__thumbnail">
          <img
            src={`data:image/jpeg;base64,${solve.finalWorking}`}
            alt="Final working"
          />
        </div>
      )}
      {!solve.finalWorking && (
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
          <span className="solve-card__stat">
            ⏱ {formatDuration(solve.createdAt, solve.completedAt)}
          </span>
          <span className="solve-card__stat">
            💬 {solve.feedbackHistory.length} check{solve.feedbackHistory.length !== 1 ? 's' : ''}
          </span>

          <div className="solve-card__actions">
            {solve.status === 'active' && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => onResume(solve.id)}
              >
                Resume
              </button>
            )}
            {confirmDelete ? (
              <>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => onDelete(solve.id)}
                >
                  Confirm
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setConfirmDelete(false)}
                >
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

export function SolvePage({ onNewProblem, onResumeSolve }: Props) {
  const [solves, setSolves] = useState<Solve[]>([])

  useEffect(() => {
    setSolves(getSolves())
  }, [])

  function handleDelete(id: string) {
    deleteSolve(id)
    setSolves(getSolves())
  }

  const completed = solves.filter((s) => s.status === 'completed')
  const active = solves.filter((s) => s.status === 'active')

  return (
    <div className="page solve-list-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero__inner">
          <h1 className="hero__title">
            Practice smarter.<br />
            <em>Get feedback as you go.</em>
          </h1>
          <p className="hero__sub">
            Work through maths problems on a whiteboard while AI checks your
            reasoning in real-time and speaks feedback aloud.
          </p>
          <button className="btn btn--primary btn--lg" onClick={onNewProblem}>
            <span>Start a new problem</span>
            <span className="btn__arrow">→</span>
          </button>
        </div>
      </section>

      {/* Solve history */}
      <main className="solve-list-page__main">
        {solves.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📐</div>
            <h2 className="empty-state__title">No solves yet</h2>
            <p className="empty-state__body">
              Start your first problem above. Your work and feedback will be saved here.
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
    </div>
  )
}
