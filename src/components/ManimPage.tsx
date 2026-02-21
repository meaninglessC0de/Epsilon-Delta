import { useState, useRef, useEffect } from 'react'
import { getStoredToken } from '../lib/auth'

interface Props {
  onBack: () => void
}

type Phase = 'idle' | 'loading' | 'done' | 'error'

const LOADING_STEPS = [
  { label: 'Writing animation script…', duration: 8000 },
  { label: 'Generating voiceover…', duration: 10000 },
  { label: 'Rendering animation…', duration: 30000 },
  { label: 'Mixing audio and video…', duration: 8000 },
]

export function ManimPage({ onBack }: Props) {
  const [question, setQuestion] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loadingStep, setLoadingStep] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Advance loading step labels over time
  useEffect(() => {
    if (phase !== 'loading') {
      setLoadingStep(0)
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current)
      return
    }
    let step = 0
    function advance() {
      step = Math.min(step + 1, LOADING_STEPS.length - 1)
      setLoadingStep(step)
      if (step < LOADING_STEPS.length - 1) {
        stepTimerRef.current = setTimeout(advance, LOADING_STEPS[step].duration)
      }
    }
    stepTimerRef.current = setTimeout(advance, LOADING_STEPS[0].duration)
    return () => { if (stepTimerRef.current) clearTimeout(stepTimerRef.current) }
  }, [phase])

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
      abortRef.current?.abort()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    if (!question.trim() || phase === 'loading') return

    // Revoke old video
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
      setVideoUrl(null)
    }

    setPhase('loading')
    setError(null)
    setLoadingStep(0)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const token = getStoredToken()
      const res = await fetch('/api/manim/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: question.trim() }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error ?? res.statusText)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setVideoUrl(url)
      setPhase('done')

      // Auto-play once metadata loads
      setTimeout(() => {
        videoRef.current?.play().catch(() => {})
      }, 100)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('error')
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
    setPhase('idle')
  }

  function handleTryAnother() {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    setPhase('idle')
    setQuestion('')
  }

  return (
    <div className="manim-page">
      <div className="manim-inner">

        {/* Header */}
        <div className="manim-header">
          <button className="btn btn--ghost btn--sm" onClick={onBack}>
            ← Back
          </button>
          <div>
            <h1 className="manim-title">Video Explanation</h1>
            <p className="manim-sub">Enter a maths problem and get an animated video walkthrough.</p>
          </div>
        </div>

        {/* Input */}
        {(phase === 'idle' || phase === 'error') && (
          <div className="manim-input-section">
            <label className="form-label">Your problem</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Solve x² + 5x + 6 = 0 by factorising"
              disabled={phase === 'loading'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate()
              }}
            />
            <p className="form-hint">⌘ + Enter to generate</p>

            {phase === 'error' && error && (
              <div style={{
                marginTop: '12px',
                padding: '12px 16px',
                background: 'var(--danger-bg)',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--danger)',
                fontSize: '0.88rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: '20px' }}>
              <button
                className="btn btn--primary btn--lg"
                onClick={handleGenerate}
                disabled={!question.trim()}
              >
                <span>Generate explanation</span>
                <span className="btn__arrow">→</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {phase === 'loading' && (
          <div className="manim-loading">
            <div className="manim-spinner" />
            <p className="manim-loading__step">{LOADING_STEPS[loadingStep].label}</p>
            <p className="manim-loading__hint">This takes 30–90 seconds the first time.</p>
            <button
              className="btn btn--ghost btn--sm"
              style={{ marginTop: '20px' }}
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Video */}
        {phase === 'done' && videoUrl && (
          <div className="manim-result">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="manim-video"
              playsInline
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
              <a
                href={videoUrl}
                download="explanation.mp4"
                className="btn btn--ghost"
              >
                Download MP4
              </a>
              <button className="btn btn--primary" onClick={handleTryAnother}>
                Try another problem
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
