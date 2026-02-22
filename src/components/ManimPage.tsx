import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { auth } from '../lib/firebase'
import { recordUserInput, updateVideoTopicElo, saveVideoGeneration } from '../lib/firebaseMetadata'
import { useDevelopmentProgress } from '../lib/developmentProgressToast'
import { stopSpeaking } from '../lib/elevenlabs'
import { MathVideoRenderer } from './MathVideoRenderer'
import type { ScenePlan } from '../types/video'

interface Props {
  onBack: () => void
}

interface ManimLocationState {
  fromChat?: boolean
  suggestedQuestion?: string
}

type Phase = 'idle' | 'loading' | 'playing' | 'done' | 'error'

export function ManimPage({ onBack }: Props) {
  const location = useLocation()
  const state = (location.state ?? {}) as ManimLocationState
  const [question, setQuestion] = useState(() => state.suggestedQuestion?.trim() ?? '')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [scenePlan, setScenePlan] = useState<ScenePlan | null>(null)
  const [currentNarration, setCurrentNarration] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const showProgress = useDevelopmentProgress()

  useEffect(() => {
    const s = state.suggestedQuestion?.trim()
    if (s) setQuestion(s)
  }, [state.suggestedQuestion])

  useEffect(() => () => abortRef.current?.abort(), [])

  // Stop TTS when leaving the page or when tab becomes hidden
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') stopSpeaking() }
    const onPageHide = () => stopSpeaking()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      stopSpeaking()
    }
  }, [])

  async function handleGenerate() {
    if (!question.trim() || phase === 'loading') return

    setPhase('loading')
    setError(null)
    setScenePlan(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const token = await auth.currentUser?.getIdToken()
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

      const plan = (await res.json()) as ScenePlan
      if (!plan?.segments?.length) throw new Error('No animation content generated')
      const q = question.trim()
      const uid = auth.currentUser?.uid
      if (uid) {
        recordUserInput(uid, 'video', q).catch(console.error)
        updateVideoTopicElo(uid, q).catch(console.error)
        const scriptSummary = plan.segments.map((s) => s.narration).join('\n\n')
        saveVideoGeneration(uid, q, scriptSummary).catch(console.error)
        showProgress('Personalizing future videos for you')
      }
      setScenePlan(plan)
      setPhase('playing')
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

  function handleAnimationComplete() {
    setPhase('done')
    setCurrentNarration(null)
  }

  function handleTryAnother() {
    setScenePlan(null)
    setPhase('idle')
    setQuestion('')
    setCurrentNarration(null)
  }

  return (
    <div className="manim-page">
      <div className="manim-inner">

        <div className="manim-header">
          <div className="manim-header__back-row">
            <button className="btn btn--ghost btn--sm" onClick={onBack}>
              ← Back
            </button>
          </div>
          <h1 className="manim-title">Video Explanation</h1>
        </div>

        {(phase === 'idle' || phase === 'error') && (
          <div className="manim-input-section">
            <label className="form-label">Your problem or topic</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Explain Gaussian elimination / Solve x² + 5x + 6 = 0 by factorising"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate()
              }}
            />

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

        {phase === 'loading' && (
          <div className="manim-loading">
            <div className="manim-spinner" />
            <p className="manim-loading__step">Writing animation script…</p>
            <button className="btn btn--ghost btn--sm" style={{ marginTop: '20px' }} onClick={handleCancel}>
              Cancel
            </button>
          </div>
        )}

        {(phase === 'playing' || phase === 'done') && scenePlan && (
          <div className="manim-result">
            <div className="math-video-wrapper">
              <MathVideoRenderer
                plan={scenePlan}
                onComplete={handleAnimationComplete}
                onSegmentChange={(_i, narration) => setCurrentNarration(narration)}
                autoPlay
              />
            </div>
            {currentNarration && (
              <p className="manim-narration" style={{ marginTop: '12px', fontStyle: 'italic', color: 'var(--text-2)', fontSize: '0.95rem' }}>
                {currentNarration}
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
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
