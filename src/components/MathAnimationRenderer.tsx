import { useState, useEffect, useRef, useCallback } from 'react'
import type { ScenePlan, SceneSegment, SceneStep } from '../types/animation'

const COLORS: Record<string, string> = {
  white: '#ffffff',
  blue: '#3b82f6',
  yellow: '#eab308',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  grey: '#9ca3af',
}

interface Props {
  plan: ScenePlan
  onComplete?: () => void
  onSegmentChange?: (index: number, narration: string) => void
  autoPlay?: boolean
}

export function MathAnimationRenderer({
  plan,
  onComplete,
  onSegmentChange,
  autoPlay = true,
}: Props) {
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [visibleElements, setVisibleElements] = useState<VisibleElement[]>([])
  const [layoutState, setLayoutState] = useState<'normal' | 'shrunken'>('normal')
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null)
  const elKeyRef = useRef(0)

  interface VisibleElement {
    id: string
    content: string
    color: string
    animation: string
    key: number
  }

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.95
    u.pitch = 1
    speechRef.current = u
    window.speechSynthesis.speak(u)
  }, [])

  const runStep = useCallback((step: SceneStep) => {
      if (step.action === 'show' && step.content) {
        const color = COLORS[step.color ?? 'white'] ?? COLORS.white
        const anim = step.animation ?? 'fadeIn'
        const key = elKeyRef.current++
        setVisibleElements((prev) => [
          ...prev,
          { id: `el-${key}`, content: step.content!, color, animation: anim, key },
        ])
      }
      if (step.action === 'replace' && step.index !== undefined && step.content) {
        const idx = step.index
        const color = COLORS[step.color ?? 'white'] ?? COLORS.white
        setVisibleElements((prev) => {
          const next = [...prev]
          if (idx >= 0 && idx < next.length) {
            next[idx] = { ...next[idx], content: step.content!, color, animation: 'fadeIn', key: next[idx].key }
          }
          return next
        })
      }
      if (step.action === 'hide' && step.index !== undefined) {
        const idx = step.index
        setVisibleElements((prev) => prev.filter((_, i) => i !== idx))
      }
      if (step.action === 'layout' && step.type === 'shrinkUp') {
        setLayoutState('shrunken')
      }
      if (step.action === 'highlight' && step.index !== undefined) {
        setHighlightIndex(step.index)
        setTimeout(() => setHighlightIndex(null), 1500)
      }
    },
    []
  )

  useEffect(() => {
    if (!plan.segments?.length) return

    const seg = plan.segments[segmentIndex]
    if (!seg) {
      onComplete?.()
      return
    }

    onSegmentChange?.(segmentIndex, seg.narration)
    speak(seg.narration)

    let stepIdx = 0

    const runNextStep = () => {
      if (stepIdx >= seg.steps.length) {
        const dur = (seg.duration ?? 4) * 1000
        timeoutRef.current = setTimeout(() => {
          setSegmentIndex((i) => i + 1)
          setLayoutState('normal')
        }, dur)
        return
      }

      const step = seg.steps[stepIdx]
      runStep(step)
      stepIdx++

      const delay = step.action === 'layout' ? 600 : step.action === 'highlight' ? 100 : 400
      timeoutRef.current = setTimeout(runNextStep, delay)
    }

    if (isPlaying) {
      timeoutRef.current = setTimeout(runNextStep, 300)
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      window.speechSynthesis.cancel()
    }
  }, [segmentIndex, plan.segments, isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when plan changes
  useEffect(() => {
    setSegmentIndex(0)
    setVisibleElements([])
    setLayoutState('normal')
    setHighlightIndex(null)
    elKeyRef.current = 0
  }, [plan])

  const contentBlock = (
    <div
      className="math-animation__content"
      style={{
        transform: layoutState === 'shrunken' ? 'scale(0.7) translateY(-40px)' : 'none',
        transition: 'transform 0.5s ease',
      }}
    >
      {visibleElements.map((el, i) => (
        <span
          key={el.key}
          className={`math-animation__element math-animation__element--${el.animation}`}
          style={{
            color: el.color,
            boxShadow: highlightIndex === i ? '0 0 0 3px rgba(234, 179, 8, 0.8)' : undefined,
            borderRadius: highlightIndex === i ? '6px' : undefined,
            padding: highlightIndex === i ? '2px 6px' : undefined,
            transition: 'box-shadow 0.3s, padding 0.3s',
          }}
        >
          {el.content}
        </span>
      ))}
    </div>
  )

  return (
    <div className="math-animation">
      <div className="math-animation__stage">
        {contentBlock}
      </div>
      <div className="math-animation__controls">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setIsPlaying((p) => !p)}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>
    </div>
  )
}
