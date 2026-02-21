import { useState, KeyboardEvent } from 'react'
import type { UserMetadata } from '../../../../shared/types'

interface PreferencesStepProps {
  initial: Pick<UserMetadata, 'learningPrefs' | 'learningDisabilities' | 'procrastinationLevel' | 'otherNeeds'>
  onChange: (data: Pick<UserMetadata, 'learningPrefs' | 'learningDisabilities' | 'procrastinationLevel' | 'otherNeeds'>) => void
}

export function PreferencesStep({ initial, onChange }: PreferencesStepProps) {
  const [disabilityInput, setDisabilityInput] = useState('')
  const [learningDisabilities, setLearningDisabilities] = useState<string[]>(initial.learningDisabilities ?? [])
  const [procrastinationLevel, setProcrastinationLevel] = useState<number | undefined>(initial.procrastinationLevel)
  const [otherNeeds, setOtherNeeds] = useState(initial.otherNeeds ?? '')

  const addDisability = (raw: string) => {
    const t = raw.trim()
    if (t && !learningDisabilities.includes(t)) {
      const next = [...learningDisabilities, t]
      setLearningDisabilities(next)
      setDisabilityInput('')
      onChange({ ...initial, learningDisabilities: next })
    }
  }

  const removeDisability = (d: string) => {
    const next = learningDisabilities.filter((x) => x !== d)
    setLearningDisabilities(next)
    onChange({ ...initial, learningDisabilities: next })
  }

  const setProcrastination = (n: number) => {
    setProcrastinationLevel(n)
    onChange({ ...initial, procrastinationLevel: n as 1 | 2 | 3 | 4 | 5 })
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--border)',
    fontSize: '1rem',
    fontFamily: 'var(--font-body)',
    background: 'var(--bg)',
    color: 'var(--text)',
    outline: 'none',
    width: '100%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="onboarding-card" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>♿</span> Learning disabilities or considerations
        </h3>
        <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: '8px' }}>
          Optional. Add any that apply (e.g. dyslexia, ADHD, need for more time). We’ll adapt how we present content.
        </p>
        <input
          type="text"
          value={disabilityInput}
          onChange={(e) => setDisabilityInput(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') { e.preventDefault(); addDisability(disabilityInput) }
          }}
          onBlur={() => addDisability(disabilityInput)}
          placeholder="Type and press Enter to add"
          style={inputStyle}
        />
        {learningDisabilities.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            {learningDisabilities.map((d) => (
              <span
                key={d}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {d}
                <button
                  type="button"
                  onClick={() => removeDisability(d)}
                  aria-label={`Remove ${d}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-2)' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="onboarding-card" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⏰</span> How often do you procrastinate on studying? <span style={{ color: 'var(--primary)', fontWeight: 500 }}>(required)</span>
        </h3>
        <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: '12px' }}>
          1 = rarely, 5 = very often. We use this to suggest lighter sessions or reminders if helpful.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setProcrastination(n)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-sm)',
                border: `2px solid ${procrastinationLevel === n ? 'var(--primary)' : 'var(--border)'}`,
                background: procrastinationLevel === n ? 'var(--primary-bg)' : 'var(--surface)',
                color: 'var(--text)',
                fontSize: '1.1rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'border-color var(--transition), background var(--transition)',
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="onboarding-card" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px' }}>
          <span>📝</span> Anything else we should know?
        </label>
        <textarea
          value={otherNeeds}
          onChange={(e) => { setOtherNeeds(e.target.value); onChange({ ...initial, otherNeeds: e.target.value }) }}
          onBlur={() => onChange({ ...initial, otherNeeds: otherNeeds.trim() || undefined })}
          placeholder="e.g. I prefer morning sessions, I need breaks every 20 min…"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
        />
      </div>
    </div>
  )
}
