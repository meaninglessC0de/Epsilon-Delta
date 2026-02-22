import { useState, useEffect, useMemo, useCallback } from 'react'
import { getSolves, deleteSolve } from '../lib/storage'
import type { User, Solve } from '../types'

interface Props {
  user: User
  onNewProblem: () => void
  onResumeSolve: (id: string) => void
  onGenerateVideo: () => void
  onOpenChat: () => void
}

const FAMOUS_MATHEMATICIANS = [
  'Euler', 'Gauss', 'Riemann', 'Fermat', 'Pascal', 'Descartes', 'Leibniz', 'Newton',
  'Archimedes', 'Euclid', 'Pythagoras', 'Hypatia', 'Cantor', 'Noether', 'Lovelace',
  'Turing', 'Shannon', 'Gödel', 'Poincaré', 'Ramanujan', 'Laplace', 'Lagrange',
  'Cauchy', 'Bernoulli', 'Galois', 'Abel', 'Diophantus', 'al-Khwarizmi', 'Bhaskara',
  'Kovalevskaya', 'Germain', 'Dedekind', 'Hilbert', 'Kolmogorov', 'von Neumann',
  'Euclid', 'Ptolemy', 'Fibonacci', 'Cardano', 'Viète', 'Brahmagupta', 'Omar Khayyam',
  'Tartaglia', 'Bombelli', 'Napier', 'Kepler', 'Galileo', 'Cavalieri', 'Fermat',
  'Wallis', 'Brouwer', 'Hausdorff', 'Lebesgue', 'Borel', 'Banach', 'Bourbaki',
]

function getMathematicianForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash << 5) - hash + userId.charCodeAt(i)
  return FAMOUS_MATHEMATICIANS[Math.abs(hash) % FAMOUS_MATHEMATICIANS.length]
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

/** One card for a problem sheet (group of whiteboards). */
function SheetCard({
  groupSolves,
  onDeleteGroup,
  onResume,
}: {
  groupSolves: Solve[]
  onDeleteGroup: (ids: string[]) => void
  onResume: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const first = groupSolves[0]
  const completedCount = groupSolves.filter((s) => s.status === 'completed').length
  const hasActive = groupSolves.some((s) => s.status === 'active')
  const resumeTarget = groupSolves.find((s) => s.status === 'active') ?? first

  const mostRecentSolve = useMemo(() => {
    const withThumbnail = groupSolves.filter((s) => s.finalWorking)
    if (withThumbnail.length === 0) return null
    return withThumbnail.sort((a, b) => {
      const aTs = a.feedbackHistory[a.feedbackHistory.length - 1]?.timestamp ?? a.createdAt
      const bTs = b.feedbackHistory[b.feedbackHistory.length - 1]?.timestamp ?? b.createdAt
      return bTs - aTs
    })[0]
  }, [groupSolves])

  return (
    <article className="solve-card solve-card--sheet">
      <div className="solve-card__thumbnail solve-card__thumbnail--sheet">
        {mostRecentSolve?.finalWorking ? (
          <img src={`data:image/jpeg;base64,${mostRecentSolve.finalWorking}`} alt="Most recent whiteboard" />
        ) : (
          <span className="solve-card__thumbnail-icon">📄</span>
        )}
      </div>
      <div className="solve-card__body">
        <div className="solve-card__meta">
          <span className={`solve-card__badge solve-card__badge--${hasActive ? 'active' : 'completed'}`}>
            {hasActive ? 'In Progress' : 'Completed'}
          </span>
          <span className="solve-card__date">{formatDate(first.createdAt)}</span>
        </div>
        <p className="solve-card__problem">
          {first.sheetTitle || 'Problem sheet'} ({groupSolves.length} questions)
        </p>
        <p className="solve-card__feedback">
          {completedCount}/{groupSolves.length} completed
        </p>
        <div className="solve-card__footer">
          <div className="solve-card__actions">
            {hasActive && (
              <button className="btn btn--ghost btn--sm" onClick={() => onResume(resumeTarget.id)}>
                Resume
              </button>
            )}
            {confirmDelete ? (
              <>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => onDeleteGroup(groupSolves.map((s) => s.id))}
                >
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
                Delete sheet
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export function DashboardPage({ user, onNewProblem, onResumeSolve, onGenerateVideo, onOpenChat }: Props) {
  const [solves, setSolves] = useState<Solve[]>([])
  const [loading, setLoading] = useState(true)

  const refetchSolves = useCallback(() => {
    getSolves()
      .then(setSolves)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refetchSolves()
  }, [refetchSolves])

  // Refetch when returning to dashboard (e.g. from whiteboard) so thumbnails update
  useEffect(() => {
    const onFocus = () => refetchSolves()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refetchSolves])

  async function handleDelete(id: string) {
    await deleteSolve(id)
    setSolves(await getSolves())
  }

  async function handleDeleteGroup(ids: string[]) {
    for (const id of ids) await deleteSolve(id)
    setSolves(await getSolves())
  }

  const displayName = user.name ?? user.email.split('@')[0]
  const mathematician = useMemo(() => getMathematicianForUser(user.id), [user.id])

  const { standaloneActive, standaloneCompleted, groupsActive, groupsCompleted } = useMemo(() => {
    const active = solves.filter((s) => s.status === 'active')
    const completed = solves.filter((s) => s.status === 'completed')
    const standaloneActive = active.filter((s) => !s.groupId)
    const standaloneCompleted = completed.filter((s) => !s.groupId)
    const groupIds = [...new Set(solves.map((s) => s.groupId).filter(Boolean))] as string[]
    const groupsActive: Solve[][] = []
    const groupsCompleted: Solve[][] = []
    for (const gid of groupIds) {
      const group = solves.filter((s) => s.groupId === gid).sort((a, b) => (a.questionIndex ?? 0) - (b.questionIndex ?? 0))
      const hasActive = group.some((s) => s.status === 'active')
      if (hasActive) groupsActive.push(group)
      else groupsCompleted.push(group)
    }
    return { standaloneActive, standaloneCompleted, groupsActive, groupsCompleted }
  }, [solves])

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
          <span>{standaloneCompleted.length + groupsCompleted.length} completed</span>
          {standaloneActive.length + groupsActive.length > 0 && (
            <>
              <span>·</span>
              <span>{standaloneActive.length + groupsActive.length} in progress</span>
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
            onClick={onOpenChat}
          >
            Talk to <span className="dashboard-ai-name">{mathematician}</span>
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
            {(standaloneActive.length > 0 || groupsActive.length > 0) && (
              <section className="solve-section">
                <h2 className="solve-section__title">In Progress</h2>
                <div className="solve-grid">
                  {standaloneActive.map((s) => (
                    <SolveCard
                      key={s.id}
                      solve={s}
                      onDelete={handleDelete}
                      onResume={onResumeSolve}
                    />
                  ))}
                  {groupsActive.map((group) => (
                    <SheetCard
                      key={group[0].groupId}
                      groupSolves={group}
                      onDeleteGroup={handleDeleteGroup}
                      onResume={onResumeSolve}
                    />
                  ))}
                </div>
              </section>
            )}

            {(standaloneCompleted.length > 0 || groupsCompleted.length > 0) && (
              <section className="solve-section">
                <h2 className="solve-section__title">Past Solves</h2>
                <div className="solve-grid">
                  {standaloneCompleted.map((s) => (
                    <SolveCard
                      key={s.id}
                      solve={s}
                      onDelete={handleDelete}
                      onResume={() => {}}
                    />
                  ))}
                  {groupsCompleted.map((group) => (
                    <SheetCard
                      key={group[0].groupId}
                      groupSolves={group}
                      onDeleteGroup={handleDeleteGroup}
                      onResume={onResumeSolve}
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
