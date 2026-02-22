import { useState, useEffect, useRef, useCallback } from 'react'
import katex from 'katex'
import type { ScenePlan, SceneSegment, SceneStep, ColorName } from '../types/video'
import { speakText, stopSpeaking } from '../lib/elevenlabs'

const COLORS: Record<string, string> = {
  white: '#f0f0f0',
  blue: '#58a6ff',
  green: '#3fb950',
  yellow: '#58a6ff',
  red: '#58a6ff',
  orange: '#58a6ff',
  grey: '#f0f0f0',
}

function toColor(name: string | undefined): string {
  const k = (name ?? 'white').toLowerCase()
  if (k === 'green') return COLORS.green
  if (k === 'blue' || k === 'yellow' || k === 'red' || k === 'orange') return COLORS.blue
  return COLORS.white
}

function toAnim(name: string | undefined): 'fadeIn' | 'write' | 'grow' {
  const k = (name ?? '').toLowerCase()
  if (k === 'write' || k === 'draw' || k === 'typing') return 'write'
  if (k === 'grow' || k === 'create') return 'grow'
  return 'fadeIn'
}

interface VisibleElement {
  key: number
  type: 'text' | 'equation' | 'graph' | 'table' | 'arrow'
  content?: string
  latex?: string
  formula?: string
  xRange?: [number, number]
  yRange?: [number, number]
  rows?: string[][]
  headers?: string[]
  label?: string
  color: string
  animation: string
  exiting?: boolean
}

function PlotGraph({ formula, xRange, yRange, color }: {
  formula?: string
  xRange?: [number, number]
  yRange?: [number, number]
  color?: string
}) {
  const w = 200
  const h = 110
  const xMin = xRange?.[0] ?? -4
  const xMax = xRange?.[1] ?? 4
  const yMin = yRange?.[0] ?? -2
  const yMax = yRange?.[1] ?? 12

  const fx = (x: number) => {
    try {
      const expr = (formula ?? 'x*x').replace(/\*\*/g, '**')
      const f = new Function('x', 'Math', `return ${expr}`)
      return f(x, Math)
    } catch { return x * x }
  }

  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i <= 100; i++) {
    const x = xMin + (xMax - xMin) * (i / 100)
    const y = fx(x)
    if (!Number.isNaN(y) && y >= yMin - 2 && y <= yMax + 2) {
      xs.push(x)
      ys.push(y)
    }
  }
  const toPx = (x: number, y: number) => ({
    x: 40 + ((x - xMin) / (xMax - xMin)) * (w - 60),
    y: h - 30 - ((y - yMin) / (yMax - yMin)) * (h - 50),
  })
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${toPx(x, ys[i]).x} ${toPx(x, ys[i]).y}`).join(' ')

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="math-video__graph">
      <line x1={40} y1={h - 30} x2={w - 20} y2={h - 30} stroke="#555" strokeWidth={1} />
      <line x1={40} y1={h - 30} x2={40} y2={20} stroke="#555" strokeWidth={1} />
      {pathD && <path d={pathD} fill="none" stroke={color ?? COLORS.blue} strokeWidth={2} />}
      <text x={w - 15} y={h - 12} fill="#888" fontSize={10}>x</text>
      <text x={25} y={25} fill="#888" fontSize={10}>y</text>
    </svg>
  )
}

function renderLatex(latex: string): string {
  return katex.renderToString(latex, {
    throwOnError: false,
    strict: false,
    displayMode: true,
  })
}

interface Props {
  plan: ScenePlan
  onComplete?: () => void
  onSegmentChange?: (index: number, narration: string) => void
  autoPlay?: boolean
}

export function MathVideoRenderer({
  plan,
  onComplete,
  onSegmentChange,
  autoPlay = true,
}: Props) {
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [elements, setElements] = useState<VisibleElement[]>([])
  const [layout, setLayout] = useState<'normal' | 'compact'>('normal')
  const [highlight, setHighlight] = useState<number | null>(null)
  const [playing, setPlaying] = useState(autoPlay)
  const keyRef = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const runStep = useCallback((step: SceneStep) => {
    if (step.action === 'show' && 'type' in step) {
      const s = step as { type: string; content?: string; latex?: string; formula?: string; xRange?: [number,number]; yRange?: [number,number]; rows?: string[][]; headers?: string[]; label?: string; color?: ColorName; animation?: string }
      keyRef.current += 1
      setElements((prev) => [...prev, {
        key: keyRef.current,
        type: s.type as VisibleElement['type'],
        content: s.content,
        latex: s.latex,
        formula: s.formula,
        xRange: s.xRange,
        yRange: s.yRange,
        rows: s.rows,
        headers: s.headers,
        label: s.label,
        color: toColor(s.color),
        animation: toAnim(s.animation),
      }])
    }
    if (step.action === 'replace' && 'index' in step) {
      const s = step as { index: number; content?: string; latex?: string; color?: ColorName }
      setElements((prev) => {
        const next = [...prev]
        if (s.index >= 0 && s.index < next.length) {
          next[s.index] = { ...next[s.index], content: s.content ?? next[s.index].content, latex: s.latex ?? next[s.index].latex, color: toColor(s.color) }
        }
        return next
      })
    }
    if (step.action === 'hide' && 'index' in step) {
      const idx = step.index
      setElements((prev) => {
        const keyToRemove = prev[idx]?.key
        const id = setTimeout(() => setElements((p) => p.filter((e) => e.key !== keyToRemove)), 400)
        timers.current.push(id)
        return prev.map((e, i) => i === idx ? { ...e, exiting: true } : e)
      })
    }
    if (step.action === 'layout') setLayout('compact')
    if (step.action === 'highlight') {
      setHighlight(step.index)
      timers.current.push(setTimeout(() => setHighlight(null), 1500))
    }
  }, [])

  // Segment effect: run steps, speak TTS, advance on TTS end
  useEffect(() => {
    if (!plan.segments?.length || !playing) return

    const seg = plan.segments[segmentIndex] as SceneSegment | undefined
    if (!seg) {
      onComplete?.()
      return
    }

    let cancelled = false
    onSegmentChange?.(segmentIndex, seg.narration)

    const advance = () => {
      if (cancelled) return
      clearTimers()
      setSegmentIndex((i) => i + 1)
      setLayout('normal')
    }

    // Run steps with short stagger
    let stepIdx = 0
    const runNext = () => {
      if (stepIdx >= seg.steps.length) return
      runStep(seg.steps[stepIdx] as SceneStep)
      stepIdx++
      const id = setTimeout(runNext, 250)
      timers.current.push(id)
    }
    timers.current.push(setTimeout(runNext, 200))

    // TTS: speak via ElevenLabs, advance when done (with min hold to avoid skip)
    const minHold = 800
    const segmentStart = Date.now()

    const onTTSEnd = () => {
      const elapsed = Date.now() - segmentStart
      const delay = Math.max(0, minHold - elapsed)
      timers.current.push(setTimeout(advance, delay + 200))
    }

    if (seg.narration?.trim()) {
      speakText(seg.narration, onTTSEnd).catch(() => onTTSEnd())
    } else {
      timers.current.push(setTimeout(advance, minHold + 200))
    }

    return () => {
      cancelled = true
      clearTimers()
      stopSpeaking()
    }
  }, [segmentIndex, plan.segments, playing, runStep, onComplete, onSegmentChange, clearTimers])

  // Reset when plan changes
  useEffect(() => {
    setSegmentIndex(0)
    setElements([])
    setLayout('normal')
    keyRef.current = 0
  }, [plan])

  // Stop TTS when paused or unmount
  useEffect(() => {
    if (!playing) stopSpeaking()
  }, [playing])

  useEffect(() => () => stopSpeaking(), [])

  const renderEl = (el: VisibleElement, i: number) => {
    const hl = highlight === i
    const style: React.CSSProperties = {
      color: el.color,
      boxShadow: hl ? '0 0 0 3px rgba(63,185,80,0.6)' : undefined,
      transition: 'opacity 0.3s ease, transform 0.3s ease, box-shadow 0.3s',
      ...(el.exiting ? { position: 'absolute' as const, pointerEvents: 'none' } : {}),
    }
    const anim = el.exiting ? 'math-video__el--exit' : `math-video__el--${el.animation}`

    if (el.type === 'text') return <span key={el.key} className={`math-video__el ${anim}`} style={style}>{el.content}</span>
    if (el.type === 'equation' && el.latex) {
      const html = renderLatex(el.latex)
      return <span key={el.key} className={`math-video__el ${anim}`} style={{ ...style, display: 'inline-block' }} dangerouslySetInnerHTML={{ __html: html }} />
    }
    if (el.type === 'graph') return (
      <div key={el.key} className={`math-video__el ${anim}`} style={style}>
        <PlotGraph formula={el.formula} xRange={el.xRange} yRange={el.yRange} color={el.color} />
      </div>
    )
    if (el.type === 'table' && el.rows) return (
      <div key={el.key} className={`math-video__el ${anim}`} style={style}>
        <table className="math-video__table">
          {el.headers && <thead><tr>{el.headers.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>}
          <tbody>{el.rows.map((row, r) => <tr key={r}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    )
    if (el.type === 'arrow') return <span key={el.key} className={`math-video__el ${anim}`} style={{ ...style, fontSize: '1.5em' }}>{el.label ?? '→'}</span>
    return null
  }

  const scale = elements.filter((e) => !e.exiting).length <= 2 ? 1 : elements.filter((e) => !e.exiting).length <= 4 ? 0.9 : 0.8

  return (
    <div className="math-video">
      <div className="math-video__viewport">
        <div className="math-video__stage">
          <div
            className="math-video__content"
            style={{
              transform: layout === 'compact' ? `scale(${0.85 * scale}) translateY(-12px)` : `scale(${scale})`,
              transition: 'transform 0.5s ease',
            }}
          >
            {elements.map(renderEl)}
          </div>
        </div>
      </div>
      <div className="math-video__controls">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
    </div>
  )
}
