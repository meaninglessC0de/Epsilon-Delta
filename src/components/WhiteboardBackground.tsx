import { useState, useEffect, useRef } from 'react'
import { ReactTyped } from 'react-typed'

// Equations use Unicode: ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼ (superscript), ₀₁₂₃₄₅₆₇₈₉ (subscript), ⁄ (fraction), ½⅓¼ etc.
const EQUATIONS = [
  '∫₀^∞ e⁻ˣ² dx = √π⁄₂',
  'limₙ→∞ (1+¹⁄ₙ)ⁿ = e',
  '∑ₖ₌₁ⁿ k = n(n+1)⁄₂',
  'd⁄dx [x²] = 2x',
  'f(x) = ∫ g(t) dt',
  '∂²u⁄∂t² = c² ∇²u',
  'eⁱπ + 1 = 0',
  '∫∫_D (∂Q⁄∂x − ∂P⁄∂y) dA',
  'Σ aₙ xⁿ → radius R',
  '∇·E = ρ⁄ε₀',
  'dy⁄dx = f(x,y)',
  '√(a² + b²) ≤ |a| + |b|',
  '∑ₙ₌₀^∞ ¹⁄ₙ! = e',
  '∫ₐᵇ f(x) dx = F(b)−F(a)',
  '∇×B = μ₀J + μ₀ε₀ ∂E⁄∂t',
  'P(A|B) = P(B|A)P(A)⁄P(B)',
  'x = (−b ± √(b²−4ac))⁄₂ₐ',
  '‖u+v‖² ≤ ‖u‖² + ‖v‖²',
  '∂f⁄∂x + ∂f⁄∂y = 0',
  'limₕ→₀ (f(x+h)−f(x))⁄h',
  '∫√(1−x²) dx',
  '∑ ¹⁄ₙ² = π²⁄₆',
  'det(AB) = det(A)det(B)',
  '∇²φ = 0',
  'α + β + γ = π',
  '∫ eˣ dx = eˣ + C',
  'f ∘ g(x) = f(g(x))',
  '⟨u,v⟩ = ‖u‖‖v‖ cos θ',
  '∫₀¹ x² dx = ⅓',
  'a² + b² = c²',
  'eⁱˣ = cos x + i sin x',
  '∂²f⁄∂x² + ∂²f⁄∂y² = 0',
]

const MIN_SIZE_PX = 22
const MAX_SIZE_PX = 34
const TYPE_SPEED_MS = 88
const SPAWN_INTERVAL_MS = 1000
const VISIBLE_MS = 5500
const FADE_OUT_MS = 2200
const REMOVE_AFTER_MS = VISIBLE_MS + FADE_OUT_MS
const MAX_ITEMS = 10
const GRID_COLS = 4
const GRID_ROWS = 3
const BASE_OPACITY = 0.52
/** Minimum distance between equation anchor points so they don't overlap */
const MIN_SPACING_PX = 220
/** Center exclusion: no text over the login box (generous margin so equations stay clear) */
const EXCLUDE_CENTER_W = 520
const EXCLUDE_CENTER_H = 620

interface BoardItem {
  id: number
  x: number
  y: number
  text: string
  sizePx: number
  createdAt: number
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function isInExcludedCenter(x: number, y: number, w: number, h: number): boolean {
  const cx = w / 2
  const cy = h / 2
  const left = cx - EXCLUDE_CENTER_W / 2
  const right = cx + EXCLUDE_CENTER_W / 2
  const top = cy - EXCLUDE_CENTER_H / 2
  const bottom = cy + EXCLUDE_CENTER_H / 2
  return x >= left && x <= right && y >= top && y <= bottom
}

function isFarEnoughFromAll(x: number, y: number, existing: { x: number; y: number }[]): boolean {
  for (const other of existing) {
    const dx = x - other.x
    const dy = y - other.y
    if (Math.sqrt(dx * dx + dy * dy) < MIN_SPACING_PX) return false
  }
  return true
}

function getGridPosition(
  w: number,
  h: number,
  existing: { x: number; y: number }[]
): { x: number; y: number } | null {
  const cellW = w / GRID_COLS
  const cellH = h / GRID_ROWS
  const padding = 32
  const maxAttempts = 50
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const col = Math.floor(Math.random() * GRID_COLS)
    const row = Math.floor(Math.random() * GRID_ROWS)
    const x = col * cellW + randomInRange(padding, Math.max(padding, cellW - 100))
    const y = row * cellH + randomInRange(padding + 24, Math.max(padding + 24, cellH - 48))
    if (!isInExcludedCenter(x, y, w, h) && isFarEnoughFromAll(x, y, existing)) return { x, y }
  }
  return null
}

export function WhiteboardBackground() {
  const [items, setItems] = useState<BoardItem[]>([])
  const [now, setNow] = useState(() => Date.now())
  const nextIdRef = useRef(0)

  useEffect(() => {
    const addItem = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      setItems((prev) => {
        if (prev.length >= MAX_ITEMS) return prev
        const existing = prev.map((it) => ({ x: it.x, y: it.y }))
        const pos = getGridPosition(w, h, existing)
        if (!pos) return prev
        const id = nextIdRef.current++
        return [
          ...prev,
          {
            id,
            x: pos.x,
            y: pos.y,
            text: EQUATIONS[Math.floor(Math.random() * EQUATIONS.length)],
            sizePx: Math.round(randomInRange(MIN_SIZE_PX, MAX_SIZE_PX)),
            createdAt: Date.now(),
          },
        ]
      })
    }

    addItem()
    const spawnTimer = setInterval(addItem, SPAWN_INTERVAL_MS)

    let rafId: number
    const tick = () => {
      setNow(Date.now())
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    const cleanupTimer = setInterval(() => {
      const t = Date.now()
      setItems((prev) => prev.filter((it) => t - it.createdAt < REMOVE_AFTER_MS))
    }, 250)

    return () => {
      clearInterval(spawnTimer)
      cancelAnimationFrame(rafId)
      clearInterval(cleanupTimer)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="whiteboard-background"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        background: 'var(--bg)',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {items.map((it) => {
        const age = now - it.createdAt
        if (age > REMOVE_AFTER_MS) return null
        let opacity = BASE_OPACITY
        if (age > VISIBLE_MS) {
          const fadeProgress = (age - VISIBLE_MS) / FADE_OUT_MS
          opacity = Math.max(0, BASE_OPACITY * (1 - fadeProgress))
        }
        return (
          <div
            key={it.id}
            style={{
              position: 'absolute',
              left: it.x,
              top: it.y,
              fontSize: it.sizePx,
              fontFamily: 'var(--font-whiteboard)',
              color: 'var(--text-2)',
              opacity,
              lineHeight: 1.3,
              maxWidth: 'calc(100vw - 2rem)',
            }}
          >
            <ReactTyped
              strings={[it.text]}
              typeSpeed={TYPE_SPEED_MS}
              showCursor={false}
              loop={false}
            />
          </div>
        )
      })}
    </div>
  )
}
