export type ColorName = 'white' | 'blue' | 'yellow' | 'green' | 'red' | 'orange' | 'grey'
export type AnimationName = 'fadeIn' | 'write' | 'grow'

export interface ShowStep {
  action: 'show'
  type: 'text' | 'equation' | 'graph' | 'table' | 'arrow'
  content?: string
  latex?: string
  formula?: string
  xRange?: [number, number]
  yRange?: [number, number]
  rows?: string[][]
  headers?: string[]
  label?: string
  color?: ColorName
  animation?: AnimationName
}

export interface ReplaceStep {
  action: 'replace'
  index: number
  type: 'text' | 'equation'
  content?: string
  latex?: string
  color?: ColorName
  animation?: AnimationName
}

export interface HideStep {
  action: 'hide'
  index: number
}

export interface LayoutStep {
  action: 'layout'
  type: 'shrinkUp'
}

export interface HighlightStep {
  action: 'highlight'
  index: number
  style: 'indicate' | 'circumscribe'
}

export type SceneStep = ShowStep | ReplaceStep | HideStep | LayoutStep | HighlightStep

export interface SceneSegment {
  narration: string
  duration: number
  steps: SceneStep[]
}

export interface ScenePlan {
  segments: SceneSegment[]
}
