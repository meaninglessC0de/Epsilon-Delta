import type { UserMetadata } from '../../../../shared/types'

type LearningStyle = NonNullable<UserMetadata['learningStyle']>
type TonePreference = NonNullable<UserMetadata['tonePreference']>
type EnvironmentPreference = NonNullable<UserMetadata['environmentPreference']>
type ContentEngagement = NonNullable<UserMetadata['contentEngagement']>

interface LearningStyleStepProps {
  initial: Pick<UserMetadata, 'learningStyle' | 'tonePreference' | 'environmentPreference' | 'contentEngagement'>
  onChange: (data: Pick<UserMetadata, 'learningStyle' | 'tonePreference' | 'environmentPreference' | 'contentEngagement'>) => void
}

const LEARNING_STYLE_OPTIONS: { value: LearningStyle; label: string; question: string; icon: string }[] = [
  { value: 'visual', label: 'Visual', question: 'I prefer diagrams, sketches, and seeing steps written out', icon: '👁️' },
  { value: 'auditory', label: 'Auditory', question: 'I learn better when I hear explanations or talk through ideas', icon: '🔊' },
  { value: 'reading', label: 'Reading', question: 'I like to read carefully and work through written material', icon: '📖' },
  { value: 'kinesthetic', label: 'Hands-on', question: 'I learn by doing: trying problems and experimenting', icon: '🛠️' },
  { value: 'mixed', label: 'Mixed', question: 'A bit of everything depending on the topic', icon: '🧩' },
  { value: 'unsure', label: 'Not sure', question: 'I’m not sure yet', icon: '❓' },
]

const TONE_OPTIONS: { value: TonePreference; label: string; question: string; icon: string }[] = [
  { value: 'funny_light', label: 'Fun & light', question: 'Encouraging and a bit funny — keeps me relaxed', icon: '😄' },
  { value: 'balanced', label: 'Balanced', question: 'Friendly but clear and to the point', icon: '⚖️' },
  { value: 'serious_technical', label: 'Serious & technical', question: 'Straightforward and precise, minimal fluff', icon: '📐' },
  { value: 'unsure', label: 'Not sure', question: 'I’m fine with any tone', icon: '💭' },
]

const ENVIRONMENT_OPTIONS: { value: EnvironmentPreference; label: string; question: string; icon: string }[] = [
  { value: 'quiet', label: 'Quiet', question: 'I focus best in a quiet environment', icon: '🤫' },
  { value: 'background_noise', label: 'Background noise', question: 'A bit of music or ambient noise helps me', icon: '🎵' },
  { value: 'group', label: 'With others', question: 'I like studying or discussing with others', icon: '👥' },
  { value: 'unsure', label: 'Flexible', question: 'It depends on the day', icon: '🔄' },
]

const CONTENT_OPTIONS: { value: ContentEngagement; label: string; question: string; icon: string }[] = [
  { value: 'short_bites', label: 'Short bites', question: 'Short, focused explanations and quick checks', icon: '⚡' },
  { value: 'deep_dives', label: 'Deep dives', question: 'Longer, detailed explanations when I’m stuck', icon: '🔬' },
  { value: 'examples_first', label: 'Examples first', question: 'Show me a worked example, then I’ll try', icon: '📋' },
  { value: 'theory_first', label: 'Theory first', question: 'Give me the idea or rule first, then examples', icon: '📚' },
  { value: 'unsure', label: 'Not sure', question: 'I’m still figuring out what works', icon: '❓' },
]

type OptionWithIcon = { value: string; label: string; question: string; icon?: string }

function CardGroup<T extends string>({
  title,
  icon: titleIcon,
  options,
  value,
  onChange,
}: {
  title: string
  icon?: string
  options: OptionWithIcon[]
  value: T | undefined
  onChange: (v: T) => void
}) {
  return (
    <div className="onboarding-card" style={{ marginBottom: '28px', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {titleIcon && <span style={{ fontSize: '1.15rem' }}>{titleIcon}</span>}
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value as T)}
            style={{
              textAlign: 'left',
              padding: '14px 16px',
              borderRadius: 'var(--radius-sm)',
              border: `2px solid ${value === o.value ? 'var(--primary)' : 'var(--border)'}`,
              background: value === o.value ? 'var(--primary-bg)' : 'var(--surface)',
              color: 'var(--text)',
              fontSize: '0.95rem',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'border-color var(--transition), background var(--transition)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            {o.icon != null && (
              <span style={{ fontSize: '1.35rem', lineHeight: 1, flexShrink: 0 }} aria-hidden>
                {o.icon}
              </span>
            )}
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>{o.label}</span>
              <span style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>{o.question}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function LearningStyleStep({ initial, onChange }: LearningStyleStepProps) {
  const learningStyle = initial.learningStyle ?? undefined
  const tonePreference = initial.tonePreference ?? undefined
  const environmentPreference = initial.environmentPreference ?? undefined
  const contentEngagement = initial.contentEngagement ?? undefined

  return (
    <div>
      <p style={{ color: 'var(--text-2)', marginBottom: '20px', fontSize: '0.95rem' }}>
        These help us match how you learn and what kind of feedback you like. All required.
      </p>
      <CardGroup
        title="When you study, what helps you most?"
        icon="👁️"
        options={LEARNING_STYLE_OPTIONS}
        value={learningStyle}
        onChange={(v) => onChange({ ...initial, learningStyle: v })}
      />
      <CardGroup
        title="How do you like feedback to sound?"
        icon="💬"
        options={TONE_OPTIONS}
        value={tonePreference}
        onChange={(v) => onChange({ ...initial, tonePreference: v })}
      />
      <CardGroup
        title="Where do you study best?"
        icon="🏠"
        options={ENVIRONMENT_OPTIONS}
        value={environmentPreference}
        onChange={(v) => onChange({ ...initial, environmentPreference: v })}
      />
      <CardGroup
        title="What type of content do you engage with best?"
        icon="📄"
        options={CONTENT_OPTIONS}
        value={contentEngagement}
        onChange={(v) => onChange({ ...initial, contentEngagement: v })}
      />
    </div>
  )
}
