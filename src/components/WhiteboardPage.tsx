import { useState, useEffect, useRef, useCallback } from 'react'
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw'
import type { FeedbackEntry, Solve } from '../types'
import { getSolveById, saveSolve } from '../lib/storage'
import { checkWorking, getFinalFeedback } from '../lib/claude'
import { speakText, stopSpeaking } from '../lib/elevenlabs'

const CHECK_INTERVAL = parseInt(import.meta.env.VITE_CHECK_INTERVAL ?? '45', 10)

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
  const isMutedRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards against speakText being called after the component has unmounted.
  // performCheck can still be mid-execution (awaiting Claude) when the user
  // navigates away — isMountedRef lets us skip the TTS call in that case.
  const isMountedRef = useRef(true)

  const [latestFeedback, setLatestFeedback] = useState<FeedbackEntry | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [nextCheckIn, setNextCheckIn] = useState(CHECK_INTERVAL)
  const [checkError, setCheckError] = useState<string | null>(null)

  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

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

  const captureCanvas = useCallback(async (): Promise<string | null> => {
    const api = excalidrawAPIRef.current
    if (!api) return null
    try {
      const blob = await exportToBlob({
        elements: api.getSceneElements(),
        appState: { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false },
        files: api.getFiles(),
        mimeType: 'image/jpeg',
        quality: 0.8,
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

  const performCheck = useCallback(async () => {
    if (isCheckingRef.current) return
    isCheckingRef.current = true
    setIsChecking(true)
    setCheckError(null)

    try {
      const base64 = await captureCanvas()
      if (!base64) return

      const lastFeedback = feedbackHistoryRef.current[feedbackHistoryRef.current.length - 1]?.feedback
      const result = await checkWorking(solve.problem, base64, lastFeedback)

      const entry: FeedbackEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        feedback: result.feedback,
        snapshot: base64,
        isCorrect: result.isCorrect,
        hints: result.hints,
        encouragement: result.encouragement,
      }

      feedbackHistoryRef.current = [...feedbackHistoryRef.current, entry]
      setLatestFeedback(entry)
      setShowToast(true)

      // Auto-dismiss toast after 12 seconds
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setShowToast(false), 12000)

      // Persist
      const current = getSolveById(solve.id)
      if (current) {
        current.feedbackHistory.push(entry)
        saveSolve(current)
      }

      // Only speak if still on this page — guards against post-unmount audio
      if (isMountedRef.current && !isMutedRef.current) {
        speakText(`${result.encouragement}. ${result.feedback}`).catch(console.error)
      }
    } catch (err) {
      console.error('Check error:', err)
      setCheckError(err instanceof Error ? err.message : 'Failed to check work')
    } finally {
      setIsChecking(false)
      isCheckingRef.current = false
    }
  }, [captureCanvas, solve.id, solve.problem])

  // Countdown + periodic trigger.
  // Fire the API call PREFETCH_OFFSET seconds before the timer hits zero so that
  // the ~6-7s response arrives just as the counter resets — feedback appears at zero.
  const PREFETCH_OFFSET = 7
  useEffect(() => {
    const t = setInterval(() => {
      setNextCheckIn((n) => {
        if (n === PREFETCH_OFFSET) {
          performCheck() // start early; response arrives ~when timer hits 0
        }
        if (n <= 1) {
          return CHECK_INTERVAL // reset the visual counter
        }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [performCheck])

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

    const current = getSolveById(solve.id) ?? solve
    current.completedAt = Date.now()
    current.status = 'completed'
    if (base64) current.finalWorking = base64
    current.finalFeedback = lastFeedback?.feedback ?? 'Session completed.'
    saveSolve(current)

    onFinish() // navigate away immediately

    // Background: get a proper final summary and silently update storage
    if (base64) {
      getFinalFeedback(solve.problem, base64)
        .then((finalFeedback) => {
          const stored = getSolveById(solve.id)
          if (stored) { stored.finalFeedback = finalFeedback; saveSolve(stored) }
        })
        .catch(console.error)
    }
  }, [captureCanvas, isFinishing, onFinish, solve])

  const circumference = 2 * Math.PI * 14
  const dashOffset = circumference * (nextCheckIn / CHECK_INTERVAL)

  return (
    <div className="whiteboard-page">
      <header className="wb-header">
        <div className="wb-header__problem">
          <span className="wb-header__problem-label">Problem</span>
          <span className="wb-header__problem-text">
            {solve.problem.length > 90 ? solve.problem.slice(0, 90) + '…' : solve.problem}
          </span>
        </div>

        <div className="wb-header__center">
          <button
            className={`check-ring ${isChecking ? 'check-ring--active' : ''}`}
            onClick={performCheck}
            title="Click to check now"
            disabled={isChecking}
          >
            <svg viewBox="0 0 32 32" width="38" height="38">
              <circle cx="16" cy="16" r="14" className="check-ring__track" />
              <circle
                cx="16" cy="16" r="14"
                className="check-ring__progress"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: dashOffset,
                  transform: 'rotate(-90deg)',
                  transformOrigin: '50% 50%',
                }}
              />
            </svg>
            <span className="check-ring__label">{isChecking ? '…' : `${nextCheckIn}s`}</span>
          </button>
          <span className="wb-header__status">
            {isChecking ? 'Checking…' : `Check in ${nextCheckIn}s`}
          </span>
        </div>

        <div className="wb-header__right">
          <span className="wb-header__timer">{formatTime(sessionSeconds)}</span>

          <button
            className={`btn btn--ghost btn--sm ${isMuted ? 'btn--muted' : ''}`}
            onClick={() => { setIsMuted((m) => !m); if (!isMuted) stopSpeaking() }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          <button
            className="btn btn--primary btn--sm"
            onClick={handleFinish}
            disabled={isFinishing}
          >
            {isFinishing ? 'Saving…' : 'Finish ✓'}
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
        <div className="wb-canvas">
          <Excalidraw
            excalidrawAPI={(api) => { excalidrawAPIRef.current = api }}
            initialData={{ appState: { viewBackgroundColor: '#ffffff', currentItemFontFamily: 1 } }}
            UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false, export: false } }}
          />

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

          {/* Problem image thumbnail (if uploaded) */}
          {solve.problemImage && (
            <div className="wb-problem-thumb">
              <img src={`data:image/jpeg;base64,${solve.problemImage}`} alt="Problem" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
