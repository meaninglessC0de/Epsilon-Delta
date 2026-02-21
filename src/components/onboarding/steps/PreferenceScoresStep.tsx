import type { PreferenceScores } from '../../../../shared/preferenceScoresSchema'
import { GAMIFIED_QUESTIONS, getDefaultPreferenceScores } from '../../../../shared/preferenceScoresSchema'
import type { Rating } from '../../../../shared/preferenceScoresSchema'

interface PreferenceScoresStepProps {
  initial: PreferenceScores | undefined
  onChange: (scores: PreferenceScores) => void
}

const RATINGS: Rating[] = [1, 2, 3, 4, 5]

/** Section icon by question id */
const SECTION_ICONS: Record<string, string> = {
  exampleVsHints: '💡',
  sessionLength: '⏱️',
  explanationLength: '📝',
  goal: '🎯',
  approach: '🧭',
}

/** Option icon by question id and option label (exact match) */
function getOptionIcon(questionId: string, label: string): string {
  const map: Record<string, Record<string, string>> = {
    exampleVsHints: { 'See a full worked example first': '📋', 'Try it with hints when I’m stuck': '💬' },
    goal: {
      'Really understand how things work': '🧠',
      'Pass exams': '📋',
      'Build strong basics': '🏗️',
      'Learn lots of topics': '🌐',
    },
    approach: {
      'Step-by-step: build from basics': '🪜',
      'Big picture first, then details': '🗺️',
    },
  }
  return map[questionId]?.[label] ?? '•'
}

function mergeInto(scores: PreferenceScores, partial: Record<string, Record<string, number>>): PreferenceScores {
  const next = JSON.parse(JSON.stringify(scores)) as PreferenceScores
  for (const [cat, opts] of Object.entries(partial)) {
    if (!next[cat as keyof PreferenceScores]) next[cat as keyof PreferenceScores] = {}
    Object.entries(opts).forEach(([k, v]) => {
      (next[cat as keyof PreferenceScores] as Record<string, number>)[k] = v
    })
  }
  return next
}

function RatingDots({ value, onChange }: { value: number; onChange: (v: Rating) => void }) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {RATINGS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          title={`${r}`}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: `2px solid ${value === r ? 'var(--primary)' : 'var(--border)'}`,
            background: value === r ? 'var(--primary)' : 'var(--surface)',
            color: value === r ? 'var(--primary-text)' : 'var(--text-2)',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

export function PreferenceScoresStep({ initial, onChange }: PreferenceScoresStepProps) {
  const scores: PreferenceScores = initial ?? getDefaultPreferenceScores()

  const applyChoice = (set: Record<string, Record<string, number>>) => {
    const next = mergeInto(scores, set)
    onChange(next)
  }

  const setRate = (category: keyof PreferenceScores, optionKey: string, value: Rating) => {
    const next = mergeInto(scores, { [category]: { [optionKey]: value } })
    onChange(next)
  }

  const getRate = (category: keyof PreferenceScores, optionKey: string): number => {
    const cat = scores[category]
    if (!cat || typeof (cat as Record<string, number>)[optionKey] !== 'number') return 3
    return Math.min(5, Math.max(1, (cat as Record<string, number>)[optionKey]))
  }

  const isOptionSelected = (set: Record<string, Record<string, number>>): boolean =>
    Object.entries(set).every(([cat, opts]) =>
      Object.entries(opts).every(([k, v]) => (scores[cat as keyof PreferenceScores] as Record<string, number>)?.[k] === v)
    )

  const choiceButtonStyle = (selected: boolean) => ({
    textAlign: 'left' as const,
    padding: '14px 16px',
    borderRadius: 'var(--radius-sm)',
    border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
    background: selected ? 'var(--primary-light)' : 'var(--surface)',
    color: 'var(--text)',
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'border-color var(--transition), background var(--transition)',
    display: 'flex' as const,
    alignItems: 'center',
    gap: '12px',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', marginBottom: '4px' }}>
        Quick picks — we’ll use these to tailor your experience. All required.
      </p>
      {GAMIFIED_QUESTIONS.map((q) => (
        <section
          key={q.id}
          className="onboarding-card"
          style={{
            padding: '22px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)', marginBottom: '16px', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {SECTION_ICONS[q.id] && <span style={{ fontSize: '1.2rem' }}>{SECTION_ICONS[q.id]}</span>}
            {q.prompt}
          </h3>
          {q.type === 'wouldYouRather' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {q.options.map((opt) => {
                const set = opt.set as Record<string, Record<string, number>>
                const icon = getOptionIcon(q.id, opt.label)
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => applyChoice(set)}
                    style={choiceButtonStyle(isOptionSelected(set))}
                  >
                    <span style={{ fontSize: '1.3rem', flexShrink: 0 }} aria-hidden>{icon}</span>
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          )}
          {q.type === 'rate' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{q.low}</span>
                <RatingDots
                  value={getRate(q.category, q.optionKey)}
                  onChange={(v) => setRate(q.category, q.optionKey, v)}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{q.high}</span>
              </div>
            </div>
          )}
          {q.type === 'pickOne' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {q.options.map((opt) => {
                const set = opt.set as Record<string, Record<string, number>>
                const icon = getOptionIcon(q.id, opt.label)
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => applyChoice(set)}
                    style={choiceButtonStyle(isOptionSelected(set))}
                  >
                    <span style={{ fontSize: '1.3rem', flexShrink: 0 }} aria-hidden>{icon}</span>
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
