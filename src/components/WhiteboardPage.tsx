import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Excalidraw, exportToBlob, restore } from '@excalidraw/excalidraw'
import type { FeedbackEntry, Solve, WhiteboardState } from '../types'
import { auth } from '../lib/firebase'
import { getSolveById, saveSolve, saveWhiteboard, getWhiteboard, getSolvesByGroupId } from '../lib/storage'
import { checkWorking, getFinalFeedback, refreshMemory } from '../lib/claude'
import { getMemory, updateMemory, getMetadataForAgent } from '../lib/memory'
import { incrementSolveCount, updateTopicElo } from '../lib/firebaseMetadata'
import { speakText, stopSpeaking } from '../lib/elevenlabs'

/** How often to analyze the whiteboard (seconds). Use VITE_ANALYZE_INTERVAL in .env to override. */
const ANALYZE_INTERVAL = parseInt(import.meta.env.VITE_ANALYZE_INTERVAL ?? '20', 10)
/** Only show highlight when region area is below this (avoids full-board "highlight anything" bug). */
const HIGHLIGHT_MAX_AREA = 0.7
/** How long to show the error highlight overlay (ms) */
const HIGHLIGHT_DURATION_MS = 6000
/** Max dimension for image sent to AI (smaller = faster analysis). */
const CHECK_IMAGE_MAX_DIM = 600
/** How often to auto-persist whiteboard state to DB (ms). */
const PERSIST_WHITEBOARD_INTERVAL_MS = 30_000

interface Props {
  solve: Solve
  onFinish: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function WhiteboardPage({ solve, onFinish }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawAPIRef = useRef<any>(null)
  const feedbackHistoryRef = useRef<FeedbackEntry[]>(solve.feedbackHistory)
  const isCheckingRef = useRef(false)
  const lastCheckedSignatureRef = useRef<string | null>(null)
  const isMutedRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards against speakText being called after the component has unmounted.
  // performCheck can still be mid-execution (awaiting Claude) when the user
  // navigates away — isMountedRef lets us skip the TTS call in that case.
  const isMountedRef = useRef(true)
  const handleFinishRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  const [latestFeedback, setLatestFeedback] = useState<FeedbackEntry | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [highlightRegion, setHighlightRegion] = useState<FeedbackEntry['highlightRegion']>(null)
  const [groupSolves, setGroupSolves] = useState<Solve[]>([])
  const navigate = useNavigate()

  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

  useEffect(() => {
    if (!solve.groupId) return
    let cancelled = false
    getSolvesByGroupId(solve.groupId).then((list) => {
      if (!cancelled) setGroupSolves(list)
    })
    return () => { cancelled = true }
  }, [solve.groupId])

  // Stop audio on unmount (React navigation) AND on browser tab close/hide.
  // The pagehide/beforeunload handlers catch the case where the ElevenLabs fetch
  // is still in-flight when the page unloads — the AbortController in speakText
  // handles cancelling the request itself, so the Audio object is never created.
  useEffect(() => {
    // Must be set to true here, not just in useRef(true), because React StrictMode
    // double-invokes effects: mount → cleanup (sets false) → mount again. Without
    // resetting here the ref stays false permanently in development.
    isMountedRef.current = true
    const handleHide = () => stopSpeaking()
    window.addEventListener('pagehide', handleHide)
    window.addEventListener('beforeunload', handleHide)
    return () => {
      isMountedRef.current = false   // prevent any in-flight performCheck from speaking
      stopSpeaking()
      window.removeEventListener('pagehide', handleHide)
      window.removeEventListener('beforeunload', handleHide)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // Session timer
  useEffect(() => {
    const t = setInterval(() => setSessionSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const captureCanvas = useCallback(async (opts?: { forCheck?: boolean }): Promise<string | null> => {
    const api = excalidrawAPIRef.current
    const container = canvasContainerRef.current
    if (!api || !container) return null
    try {
      const rect = container.getBoundingClientRect()
      let w = Math.max(1, Math.round(rect.width))
      let h = Math.max(1, Math.round(rect.height))
      if (opts?.forCheck && Math.max(w, h) > CHECK_IMAGE_MAX_DIM) {
        const scale = CHECK_IMAGE_MAX_DIM / Math.max(w, h)
        w = Math.round(w * scale)
        h = Math.round(h * scale)
      }
      const quality = opts?.forCheck ? 0.5 : 0.8
      const blob = await exportToBlob({
        elements: api.getSceneElements(),
        appState: { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false },
        files: api.getFiles(),
        getDimensions: () => ({ width: w, height: h }),
        mimeType: 'image/jpeg',
        quality,
      })
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (err) {
      console.error('Canvas capture error:', err)
      return null
    }
  }, [])

  /** Get current scene for DB persist (elements + appState). */
  const getWhiteboardState = useCallback((): { elements: unknown[]; appState: Record<string, unknown> } | null => {
    const api = excalidrawAPIRef.current
    if (!api) return null
    const elements = api.getSceneElements()
    const appState = api.getAppState() as Record<string, unknown>
    return { elements: [...elements], appState: { ...appState } }
  }, [])

  /** Save whiteboard state and update solve.finalWorking (for dashboard thumbnail). */
  const saveCurrentBoard = useCallback(async () => {
    const state = getWhiteboardState()
    const base64 = await captureCanvas()
    if (state) await saveWhiteboard(solve.id, state)
    const current = await getSolveById(solve.id)
    if (!current) return
    if (base64) current.finalWorking = base64
    current.feedbackHistory = [...feedbackHistoryRef.current]
    await saveSolve(current)
  }, [getWhiteboardState, captureCanvas, solve.id])

  const persistWhiteboardState = useCallback(async () => {
    await saveCurrentBoard()
  }, [saveCurrentBoard])

  // Auto-persist whiteboard to DB so user can resume
  useEffect(() => {
    const t = setInterval(persistWhiteboardState, PERSIST_WHITEBOARD_INTERVAL_MS)
    return () => clearInterval(t)
  }, [persistWhiteboardState])

  const performCheck = useCallback(async () => {
    if (isCheckingRef.current) return
    const api = excalidrawAPIRef.current
    if (!api) return
    const elements = api.getSceneElements()
    const signature = [
      elements.length,
      ...elements
        .map((e: { id: string; version?: number; versionNonce?: number }) =>
          `${e.id}:${e.version ?? (e as { versionNonce?: number }).versionNonce ?? 0}`,
        )
        .sort(),
    ].join('|')
    if (signature === lastCheckedSignatureRef.current) return

    isCheckingRef.current = true
    setIsChecking(true)
    setCheckError(null)

    try {
      const base64 = await captureCanvas({ forCheck: true })
      if (!base64) return

      const lastFeedback = feedbackHistoryRef.current[feedbackHistoryRef.current.length - 1]?.feedback
      const agentMeta = await getMetadataForAgent()
      const result = await checkWorking(solve.problem, base64, lastFeedback, agentMeta?.contextString)

      // Only mark complete when isCorrect (fully solved and correct). Incomplete = no alert, no exit.
      if (result.isCorrect) {
        lastCheckedSignatureRef.current = signature
        setHighlightRegion(null)
        if (isMountedRef.current) {
          handleFinishRef.current()
        }
        return
      }

      // Incomplete (not finished): no alert, no toast, no TTS — just keep working
      if (result.isIncomplete) {
        lastCheckedSignatureRef.current = signature
        setHighlightRegion(null)
        return
      }

      // Objectively wrong: show feedback, toast, TTS, highlight
      const entry: FeedbackEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        feedback: result.feedback,
        snapshot: base64,
        isCorrect: result.isCorrect,
        hints: result.hints,
        encouragement: result.encouragement,
        speakSummary: result.speakSummary,
        highlightRegion: result.highlightRegion,
      }

      feedbackHistoryRef.current = [...feedbackHistoryRef.current, entry]
      setLatestFeedback(entry)
      setShowToast(true)

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setShowToast(false), 12000)

      const region = result.highlightRegion
      const area = region ? region.width * region.height : 0
      if (region && area > 0 && area < HIGHLIGHT_MAX_AREA) {
        setHighlightRegion(region)
        setTimeout(() => setHighlightRegion(null), HIGHLIGHT_DURATION_MS)
      } else {
        setHighlightRegion(null)
      }

      const current = await getSolveById(solve.id)
      if (current) {
        current.feedbackHistory.push(entry)
        await saveSolve(current)
      }

      if (isMountedRef.current && !isMutedRef.current && result.speakSummary) {
        speakText(result.speakSummary).catch(console.error)
      }

      lastCheckedSignatureRef.current = signature
    } catch (err) {
      console.error('Check error:', err)
      setCheckError(err instanceof Error ? err.message : 'Failed to check work')
    } finally {
      setIsChecking(false)
      isCheckingRef.current = false
    }
  }, [captureCanvas, solve.id, solve.problem])

  // Periodic check every ANALYZE_INTERVAL seconds (no countdown UI).
  useEffect(() => {
    const t = setInterval(performCheck, ANALYZE_INTERVAL * 1000)
    return () => clearInterval(t)
  }, [performCheck])

  // Save: run a check first. If correct, mark completed and finish; otherwise persist and quit without completing.
  const handleSave = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)
    setCheckError(null)
    try {
      const base64 = await captureCanvas({ forCheck: true })
      if (!base64) {
        setIsSaving(false)
        return
      }
      const lastFeedback = feedbackHistoryRef.current[feedbackHistoryRef.current.length - 1]?.feedback
      const agentMeta = await getMetadataForAgent()
      const result = await checkWorking(solve.problem, base64, lastFeedback, agentMeta?.contextString)

      if (result.isCorrect && isMountedRef.current) {
        handleFinishRef.current()
        return
      }

      const current = (await getSolveById(solve.id)) ?? solve
      current.feedbackHistory = [...feedbackHistoryRef.current]
      const fullRes = await captureCanvas()
      if (fullRes) current.finalWorking = fullRes
      await saveSolve(current)
      const state = getWhiteboardState()
      if (state) await saveWhiteboard(solve.id, state)
      onFinish()
    } catch (err) {
      console.error('Save error:', err)
      setCheckError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [captureCanvas, getWhiteboardState, isSaving, solve.id, solve.problem, onFinish])

  const handleFinish = useCallback(async () => {
    if (isFinishing) return
    setIsFinishing(true)
    stopSpeaking()
    setShowToast(false)

    // Capture canvas (local, fast) then save and navigate immediately.
    // The final AI feedback is fetched in the background and written to storage
    // after navigation — no API call blocks the exit.
    const base64 = await captureCanvas()
    const lastFeedback = feedbackHistoryRef.current[feedbackHistoryRef.current.length - 1]

    const current = (await getSolveById(solve.id)) ?? solve
    current.completedAt = Date.now()
    current.status = 'completed'
    if (base64) current.finalWorking = base64
    current.finalFeedback = lastFeedback?.feedback ?? 'Session completed.'
    await saveSolve(current)
    const state = getWhiteboardState()
    if (state) await saveWhiteboard(solve.id, state)

    onFinish() // navigate away immediately

    // Background: final feedback, refresh memory, update ELO and solve count
    const lastEntry = feedbackHistoryRef.current[feedbackHistoryRef.current.length - 1]
    const uid = auth.currentUser?.uid
    if (base64 && uid) {
      const agentMeta = await getMetadataForAgent()
      getFinalFeedback(solve.problem, base64, agentMeta?.contextString)
        .then(async (finalFeedback) => {
          const stored = await getSolveById(solve.id)
          if (stored) { stored.finalFeedback = finalFeedback; await saveSolve(stored) }

          const allHints = feedbackHistoryRef.current.flatMap((e) => e.hints)
          const mem = await getMemory().catch(() => null)
          if (mem) {
            const updated = await refreshMemory(
              { topicsCovered: mem.topicsCovered, weaknesses: mem.weaknesses, solveSummaries: mem.solveSummaries },
              { problem: solve.problem, finalFeedback, hints: allHints },
              agentMeta?.contextString,
            )
            await updateMemory(updated).catch(console.error)
            const topic = updated.primaryTopic ?? 'general'
            const isCorrect = lastEntry?.isCorrect ?? false
            await updateTopicElo(uid, topic, isCorrect).catch(console.error)
          }
          await incrementSolveCount(uid).catch(console.error)
        })
        .catch(console.error)
    }
  }, [captureCanvas, getWhiteboardState, isFinishing, onFinish, solve])

  useEffect(() => {
    handleFinishRef.current = handleFinish
  }, [handleFinish])

  const currentIndex = solve.questionIndex ?? 0
  const totalInGroup = groupSolves.length || (solve.questionCount ?? 1)

  const defaultAppState = useMemo(
    () => ({
      viewBackgroundColor: '#ffffff',
      currentItemFontFamily: 1,
      elementType: 'freedraw' as const,
    }),
    [],
  )
  const initialData = useMemo(() => ({ appState: defaultAppState }), [defaultAppState])

  // Load whiteboard from DB (or legacy), then render previous work via API. Only update elements to avoid resetting viewport.
  const appliedForSolveRef = useRef<string | null>(null)
  useEffect(() => {
    if (solve.status !== 'active') return
    const solveKey = solve.id
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const clearTimeouts = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
    getWhiteboard(solve.id)
      .then((ws) => {
        if (cancelled) return
        const data = ws ?? (solve.whiteboardState?.elements?.length ? solve.whiteboardState : null)
        if (!data?.elements?.length) return
        try {
          const restored = restore(
            { elements: data.elements, appState: (data.appState || {}) as Record<string, unknown>, files: {} },
            null,
            null,
          )
          const tryApply = (attempt = 0): boolean => {
            const api = excalidrawAPIRef.current
            if (!api) return false
            if (appliedForSolveRef.current === solveKey) return true
            api.updateScene({
              elements: restored.elements,
              commitToHistory: false,
            })
            appliedForSolveRef.current = solveKey
            return true
          }
          if (!tryApply() && !cancelled) {
            const maxAttempts = 20
            const step = 100
            let attempts = 0
            const schedule = () => {
              if (cancelled || attempts >= maxAttempts) return
              timeoutId = setTimeout(() => {
                timeoutId = null
                attempts++
                if (tryApply() || cancelled) return
                schedule()
              }, step)
            }
            schedule()
          }
        } catch {
          /* ignore */
        }
      })
      .catch(console.error)
    return () => {
      cancelled = true
      clearTimeouts()
      appliedForSolveRef.current = null
    }
  }, [solve.id, solve.status])

  return (
    <div className="whiteboard-page">
      <header className="wb-header">
        <div className="wb-header__problem">
          <span className="wb-header__problem-label">Problem</span>
          <p
            className="wb-header__problem-text"
            title={solve.problem}
          >
            {solve.problem}
          </p>
        </div>

        <div className="wb-header__right">
          {groupSolves.length > 0 && (
            <div className="wb-header__group-nav-inline">
              <button
                type="button"
                className="wb-group-nav__btn"
                disabled={currentIndex <= 0 || isNavigating}
                onClick={async () => {
                  const prev = groupSolves[currentIndex - 1]
                  if (!prev) return
                  setIsNavigating(true)
                  try {
                    await saveCurrentBoard()
                    navigate(`/solve/${prev.id}`, { replace: true })
                  } finally {
                    setIsNavigating(false)
                  }
                }}
                aria-label="Previous question"
              >
                ←
              </button>
              <span className="wb-group-nav__label">
                {currentIndex + 1}/{totalInGroup}
              </span>
              <button
                type="button"
                className="wb-group-nav__btn"
                disabled={currentIndex >= totalInGroup - 1 || isNavigating}
                onClick={async () => {
                  const next = groupSolves[currentIndex + 1]
                  if (!next) return
                  setIsNavigating(true)
                  try {
                    await saveCurrentBoard()
                    navigate(`/solve/${next.id}`, { replace: true })
                  } finally {
                    setIsNavigating(false)
                  }
                }}
                aria-label="Next question"
              >
                →
              </button>
              {solve.sheetTitle && (
                <span className="wb-group-nav__title">{solve.sheetTitle}</span>
              )}
            </div>
          )}
          <span className="wb-header__timer">{formatTime(sessionSeconds)}</span>

          <button
            className={`btn btn--ghost btn--sm ${isMuted ? 'btn--muted' : ''}`}
            onClick={() => { setIsMuted((m) => !m); if (!isMuted) stopSpeaking() }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          <button
            className={`btn btn--primary btn--sm ${isSaving ? 'btn--loading' : ''}`}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <span className="btn__spinner" aria-hidden />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </header>

      {checkError && (
        <div className="wb-error-banner">
          ⚠️ {checkError}
          <button onClick={() => setCheckError(null)}>✕</button>
        </div>
      )}

      <div className="wb-body">
        <div className="wb-canvas" ref={canvasContainerRef}>
          {solve.problemImage && (
            <div className="wb-canvas__diagram" aria-hidden>
              <img src={`data:image/jpeg;base64,${solve.problemImage}`} alt="Problem diagram" />
            </div>
          )}
          <div className="wb-canvas__board">
          <Excalidraw
            key={`whiteboard-${solve.id}`}
            excalidrawAPI={(api) => { excalidrawAPIRef.current = api }}
            initialData={initialData}
            UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false, export: false } }}
          />
          </div>

          {/* Error highlight overlay — shows region where AI detected a mistake */}
          {highlightRegion && (
            <div
              className="wb-highlight"
              style={{
                left: `${highlightRegion.x * 100}%`,
                top: `${highlightRegion.y * 100}%`,
                width: `${highlightRegion.width * 100}%`,
                height: `${highlightRegion.height * 100}%`,
              }}
              aria-hidden
            />
          )}

          {/* Feedback toast — overlaid on canvas */}
          {showToast && latestFeedback && (
            <div className={`wb-toast ${latestFeedback.isCorrect ? 'wb-toast--ok' : 'wb-toast--hint'}`}>
              <div className="wb-toast__header">
                <span className="wb-toast__status">
                  {latestFeedback.isCorrect ? '✓ On track' : '💡 Feedback'}
                </span>
                <button className="wb-toast__close" onClick={() => setShowToast(false)}>✕</button>
              </div>
              <p className="wb-toast__text">{latestFeedback.feedback}</p>
              {latestFeedback.hints[0] && (
                <p className="wb-toast__hint">→ {latestFeedback.hints[0]}</p>
              )}
            </div>
          )}

          </div>
      </div>
    </div>
  )
}
