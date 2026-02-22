export interface SceneSegment {
  narration: string
  duration: number
  steps: SceneStep[]
}

export interface SceneStep {
  action: 'show' | 'replace' | 'hide' | 'layout' | 'highlight'
  content?: string
  color?: 'white' | 'blue' | 'yellow' | 'green' | 'red' | 'orange' | 'grey'
  animation?: 'fadeIn' | 'write' | 'grow' | 'indicate' | 'circumscribe'
  index?: number
  type?: 'shrinkUp'
  style?: 'indicate' | 'circumscribe'
}

export interface ScenePlan {
  segments: SceneSegment[]
}
