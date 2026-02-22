import type { TutorGraphSpec } from '../lib/claude'

const W = 280
const H = 160
const PAD = 24

function project(
  x: number,
  y: number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number
): { x: number; y: number } {
  const px = PAD + ((x - xMin) / (xMax - xMin)) * (W - 2 * PAD)
  const py = H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD)
  return { x: px, y: py }
}

function sampleQuadratic(a: number, b: number, c: number, xMin: number, xMax: number): [number, number][] {
  const points: [number, number][] = []
  const step = (xMax - xMin) / 80
  for (let x = xMin; x <= xMax; x += step) {
    const y = a * x * x + b * x + c
    points.push([x, y])
  }
  return points
}

function sampleLine(slope: number, intercept: number, xMin: number, xMax: number): [number, number][] {
  return [
    [xMin, slope * xMin + intercept],
    [xMax, slope * xMax + intercept],
  ]
}

interface Props {
  spec: TutorGraphSpec
}

export function ChatGraphVisual({ spec }: Props) {
  let xMin: number
  let xMax: number
  let yMin: number
  let yMax: number
  let pathD: string

  if (spec.type === 'quadratic') {
    xMin = spec.xMin
    xMax = spec.xMax
    const pts = sampleQuadratic(spec.a, spec.b, spec.c, xMin, xMax)
    const ys = pts.map(([, y]) => y)
    yMin = Math.min(...ys)
    yMax = Math.max(...ys)
    const padding = (yMax - yMin) * 0.1 || 1
    yMin -= padding
    yMax += padding
    const coords = pts.map(([x, y]) => project(x, y, xMin, xMax, yMin, yMax))
    pathD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  } else if (spec.type === 'line') {
    xMin = spec.xMin
    xMax = spec.xMax
    const y1 = spec.slope * xMin + spec.intercept
    const y2 = spec.slope * xMax + spec.intercept
    yMin = Math.min(y1, y2)
    yMax = Math.max(y1, y2)
    const padding = (yMax - yMin) * 0.2 || 1
    yMin -= padding
    yMax += padding
    const pts = sampleLine(spec.slope, spec.intercept, xMin, xMax)
    const coords = pts.map(([x, y]) => project(x, y, xMin, xMax, yMin, yMax))
    pathD = `M ${coords[0].x} ${coords[0].y} L ${coords[1].x} ${coords[1].y}`
  } else {
    const pts = spec.points
    if (pts.length === 0) return null
    const xs = pts.map(([x]) => x)
    const ys = pts.map(([, y]) => y)
    xMin = spec.xMin ?? Math.min(...xs)
    xMax = spec.xMax ?? Math.max(...xs)
    yMin = spec.yMin ?? Math.min(...ys)
    yMax = spec.yMax ?? Math.max(...ys)
    const xPad = (xMax - xMin) * 0.1 || 1
    const yPad = (yMax - yMin) * 0.1 || 1
    xMin -= xPad
    xMax += xPad
    yMin -= yPad
    yMax += yPad
    pathD = '' // points type: only circles, no path
  }

  const origin = project(0, 0, xMin, xMax, yMin, yMax)
  const xAxisY = 0 >= yMin && 0 <= yMax ? origin.y : H - PAD
  const xAxisStart = project(xMin, 0, xMin, xMax, yMin, yMax).x
  const xAxisEnd = project(xMax, 0, xMin, xMax, yMin, yMax).x
  const yAxisX = 0 >= xMin && 0 <= xMax ? origin.x : PAD
  const yAxisStart = project(0, yMin, xMin, xMax, yMin, yMax).y
  const yAxisEnd = project(0, yMax, xMin, xMax, yMin, yMax).y

  return (
    <div className="chat-msg__graph" aria-label="Graph">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="chat-graph-svg">
        <defs>
          <linearGradient id="chat-graph-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* axes */}
        <line x1={PAD} y1={xAxisY} x2={W - PAD} y2={xAxisY} stroke="var(--border-dark)" strokeWidth="1" />
        <line x1={yAxisX} y1={PAD} x2={yAxisX} y2={H - PAD} stroke="var(--border-dark)" strokeWidth="1" />
        {/* curve/line (not for scatter points) */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="url(#chat-graph-line-grad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {spec.type === 'points' && (
          <g>
            {spec.points.map(([x, y], i) => {
              const p = project(x, y, xMin, xMax, yMin, yMax)
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="4"
                  fill="var(--primary)"
                  stroke="var(--bg)"
                  strokeWidth="1.5"
                />
              )
            })}
          </g>
        )}
      </svg>
    </div>
  )
}
