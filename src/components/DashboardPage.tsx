import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ReactTyped } from 'react-typed'
import { getSolves, deleteSolve } from '../lib/storage'
import { getUserMetadata } from '../lib/firebaseMetadata'
import type { User, Solve } from '../types'

interface Props {
  user: User
  onNewProblem: () => void
  onResumeSolve: (id: string) => void
  onGenerateVideo: () => void
  onOpenChat: () => void
  onOpenProfile?: () => void
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
  onResumeDisabled,
}: {
  solve: Solve
  onDelete: (id: string) => void
  onResume: (id: string) => void
  onResumeDisabled?: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isActive = solve.status === 'active' || solve.status === 'incorrect'

  return (
    <article className="solve-card dashboard-card">
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
            {solve.status === 'completed' ? 'Completed' : solve.status === 'incorrect' ? 'Needs revision' : 'In Progress'}
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
          <div className="solve-card__stats">
            <span className="solve-card__stat">⏱ {formatDuration(solve.createdAt, solve.completedAt)}</span>
            <span className="solve-card__stat">
              💬 {solve.feedbackHistory.length} check{solve.feedbackHistory.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="solve-card__actions">
            {isActive && !onResumeDisabled && (
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

function SheetCard({
  groupSolves,
  onDeleteGroup,
  onResume,
  onResumeDisabled,
}: {
  groupSolves: Solve[]
  onDeleteGroup: (ids: string[]) => void
  onResume: (id: string) => void
  onResumeDisabled?: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const first = groupSolves[0]
  const completedCount = groupSolves.filter((s) => s.status === 'completed').length
  const hasActive = groupSolves.some((s) => s.status === 'active' || s.status === 'incorrect')
  const resumeTarget = groupSolves.find((s) => s.status === 'active' || s.status === 'incorrect') ?? first

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
    <article className="solve-card solve-card--sheet dashboard-card">
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
            {hasActive && !onResumeDisabled && (
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

function VideoCard({
  item,
  onRegenerate,
  onViewScript,
}: {
  item: { question: string; timestamp: number; script?: string }
  onRegenerate: () => void
  onViewScript: () => void
}) {
  const questionPreview = item.question.length > 100 ? item.question.slice(0, 100) + '…' : item.question

  return (
    <article className="dashboard-video-card dashboard-card">
      <div className="dashboard-video-card__thumbnail">
        <span className="dashboard-video-card__icon">🎬</span>
      </div>
      <div className="dashboard-video-card__body">
        <div className="dashboard-video-card__meta">
          <span className="solve-card__badge solve-card__badge--completed">Video</span>
          <span className="solve-card__date">{formatDate(item.timestamp)}</span>
        </div>
        <p className="dashboard-video-card__question">{questionPreview}</p>
        {item.script && (
          <button className="btn btn--ghost btn--sm dashboard-video-card__script-toggle" onClick={onViewScript}>
            View script
          </button>
        )}
        <div className="dashboard-video-card__actions">
          <button className="btn btn--ghost btn--sm" onClick={onRegenerate}>
            Generate again →
          </button>
        </div>
      </div>
    </article>
  )
}

type View = 'overview' | 'past-solves'

export function DashboardPage({ user, onNewProblem, onResumeSolve, onGenerateVideo, onOpenChat, onOpenProfile }: Props) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlView = searchParams.get('view') === 'past-solves' ? 'past-solves' : 'overview'
  const [solves, setSolves] = useState<Solve[]>([])
  const [videoGenerations, setVideoGenerations] = useState<{ question: string; timestamp: number; script?: string }[]>([])
  const [scriptView, setScriptView] = useState<{ question: string; script: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const view = urlView

  const refetchSolves = useCallback(() => {
    getSolves()
      .then(setSolves)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refetchSolves()
  }, [refetchSolves])

  useEffect(() => {
    getUserMetadata(user.id)
      .then((meta) => {
        if (meta?.videoGenerations?.length) {
          setVideoGenerations([...meta.videoGenerations].reverse())
        } else if (meta?.recentInputs?.length) {
          const videos = meta.recentInputs
            .filter((r) => r.type === 'video')
            .map((r) => ({ question: r.content, timestamp: r.timestamp }))
            .reverse()
          setVideoGenerations(videos)
        }
      })
      .catch(() => {})
  }, [user.id])

  useEffect(() => {
    const onFocus = () => {
      refetchSolves()
      getUserMetadata(user.id)
        .then((meta) => {
          if (meta?.videoGenerations?.length) {
            setVideoGenerations([...meta.videoGenerations].reverse())
          } else if (meta?.recentInputs?.length) {
            const videos = meta.recentInputs
              .filter((r) => r.type === 'video')
              .map((r) => ({ question: r.content, timestamp: r.timestamp }))
              .reverse()
            setVideoGenerations(videos)
          }
        })
        .catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refetchSolves, user.id])

  async function handleDelete(id: string) {
    await deleteSolve(id)
    setSolves(await getSolves())
  }

  async function handleDeleteGroup(ids: string[]) {
    for (const id of ids) await deleteSolve(id)
    setSolves(await getSolves())
  }

  const displayName = user.name ?? user.email.split('@')[0]

  const { standaloneActive, standaloneCompleted, groupsActive, groupsCompleted, allPast } = useMemo(() => {
    const active = solves.filter((s) => s.status === 'active' || s.status === 'incorrect')
    const completed = solves.filter((s) => s.status === 'completed')
    const sortByRecent = (a: Solve, b: Solve) =>
      (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt)
    const standaloneActive = active.filter((s) => !s.groupId)
    const standaloneCompleted = completed.filter((s) => !s.groupId).sort(sortByRecent)
    const groupIds = [...new Set(solves.map((s) => s.groupId).filter(Boolean))] as string[]
    const groupsActive: Solve[][] = []
    const groupsCompleted: Solve[][] = []
    for (const gid of groupIds) {
      const group = solves.filter((s) => s.groupId === gid).sort((a, b) => (a.questionIndex ?? 0) - (b.questionIndex ?? 0))
      const hasActive = group.some((s) => s.status === 'active' || s.status === 'incorrect')
      if (hasActive) groupsActive.push(group)
      else groupsCompleted.push(group)
    }
    groupsCompleted.sort((a, b) => {
      const aMax = Math.max(...a.map((s) => s.completedAt ?? s.createdAt))
      const bMax = Math.max(...b.map((s) => s.completedAt ?? s.createdAt))
      return bMax - aMax
    })
    const allPast = {
      standalone: standaloneCompleted,
      groups: groupsCompleted,
    }
    return { standaloneActive, standaloneCompleted, groupsActive, groupsCompleted, allPast }
  }, [solves])

  const hasInProgress = standaloneActive.length > 0 || groupsActive.length > 0
  const hasPast = standaloneCompleted.length > 0 || groupsCompleted.length > 0

  return (
    <div className="dashboard-page">
      {scriptView && (
        <div className="script-view-overlay" onClick={() => setScriptView(null)}>
          <div className="script-view-screen" onClick={(e) => e.stopPropagation()}>
            <div className="script-view__header">
              <h2 className="script-view__title">Video script</h2>
              <button className="btn btn--ghost btn--sm" onClick={() => setScriptView(null)}>Close</button>
            </div>
            <p className="script-view__question">{scriptView.question}</p>
            <div className="script-view__content">{scriptView.script}</div>
          </div>
        </div>
      )}
      <main className="dashboard-main">
        <header className="dashboard-hero">
          <h1 className="dashboard-greeting">
            <ReactTyped
              strings={[`${getGreeting()}, ${displayName}.`]}
              typeSpeed={40}
              showCursor={false}
              loop={false}
            />
          </h1>
          <div className="dashboard-stats">
            <span>{solves.length} problem{solves.length !== 1 ? 's' : ''} total</span>
            <span>·</span>
            <span>{standaloneCompleted.length + groupsCompleted.length} completed</span>
            {hasInProgress && (
              <>
                <span>·</span>
                <span>{standaloneActive.length + groupsActive.length} in progress</span>
              </>
            )}
          </div>
        </header>

        <div className="dashboard-content">
          {loading ? (
            <div className="dashboard-loading">
              <div className="solve-loading-spinner" />
              <p>Loading…</p>
            </div>
          ) : view === 'overview' ? (
            <div className="dashboard-view dashboard-view--overview">
              {!hasInProgress && videoGenerations.length === 0 ? (
                <div className="empty-state dashboard-empty">
                  <div className="empty-state__icon">📐</div>
                  <h2 className="empty-state__title">No solves yet</h2>
                  <p className="empty-state__body">
                    Start your first problem from the sidebar — your work and feedback will be saved here.
                  </p>
                  <button className="btn btn--primary btn--lg" onClick={onNewProblem} style={{ marginTop: 20 }}>
                    Start a new problem
                    <span className="btn__arrow">→</span>
                  </button>
                </div>
              ) : (
                <>
                  {hasInProgress && (
                    <section className="solve-section dashboard-section">
                      <h2 className="solve-section__title">In Progress</h2>
                      <div className="solve-grid">
                        {standaloneActive.map((s) => (
                          <SolveCard
                            key={s.id}
                            solve={s}
                            onDelete={handleDelete}
                            onResume={onResumeSolve}
                            onResumeDisabled={false}
                          />
                        ))}
                        {groupsActive.map((group) => (
                          <SheetCard
                            key={group[0].groupId}
                            groupSolves={group}
                            onDeleteGroup={handleDeleteGroup}
                            onResume={onResumeSolve}
                            onResumeDisabled={false}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                  {videoGenerations.length > 0 && (
                    <section className="solve-section dashboard-section">
                      <h2 className="solve-section__title">Recent video explanations</h2>
                      <div className="solve-grid dashboard-video-grid">
                        {videoGenerations.slice(0, 6).map((item, i) => (
                          <VideoCard
                            key={`${item.timestamp}-${i}`}
                            item={item}
                            onRegenerate={() => navigate('/manim', { state: { suggestedQuestion: item.question } })}
                            onViewScript={() => item.script && setScriptView({ question: item.question, script: item.script })}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="dashboard-view dashboard-view--past">
              {!hasPast ? (
                <div className="empty-state dashboard-empty">
                  <div className="empty-state__icon">📋</div>
                  <h2 className="empty-state__title">No past solves yet</h2>
                  <p className="empty-state__body">
                    Complete a problem to see it here.
                  </p>
                </div>
              ) : (
                <section className="solve-section dashboard-section">
                  <h2 className="solve-section__title">All past solves</h2>
                  <div className="solve-grid">
                    {allPast.standalone.map((s) => (
                      <SolveCard
                        key={s.id}
                        solve={s}
                        onDelete={handleDelete}
                        onResume={() => {}}
                        onResumeDisabled
                      />
                    ))}
                    {allPast.groups.map((group) => (
                      <SheetCard
                        key={group[0].groupId}
                        groupSolves={group}
                        onDeleteGroup={handleDeleteGroup}
                        onResume={onResumeSolve}
                        onResumeDisabled
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
