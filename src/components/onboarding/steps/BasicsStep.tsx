import { useState, KeyboardEvent } from 'react'
import { MATH_TOPICS } from '../../../../shared/metadataSchema'
import type { UserMetadata } from '../../../../shared/types'
import { UniversitySelect } from './UniversitySelect'

const STUDY_LEVELS = [
  { value: '', label: 'Select level…' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'postgraduate', label: 'Postgraduate' },
  { value: 'other', label: 'Other' },
]

const TOPIC_LABELS: Record<string, string> = {
  algebra: 'Algebra',
  linear_algebra: 'Linear algebra',
  calculus: 'Calculus',
  real_analysis: 'Real analysis',
  geometry: 'Geometry',
  topology: 'Topology',
  probability: 'Probability',
  statistics: 'Statistics',
  differential_equations: 'Differential equations',
  number_theory: 'Number theory',
  discrete_math: 'Discrete math',
  optimization: 'Optimization',
  complex_analysis: 'Complex analysis',
  abstract_algebra: 'Abstract algebra',
}

interface BasicsStepProps {
  initial: Pick<UserMetadata, 'university' | 'studyLevel' | 'courses' | 'mathTopics'>
  onChange: (data: Pick<UserMetadata, 'university' | 'studyLevel' | 'courses' | 'mathTopics'>) => void
}

export function BasicsStep({ initial, onChange }: BasicsStepProps) {
  const [university, setUniversity] = useState(initial.university ?? '')
  const [studyLevel, setStudyLevel] = useState(initial.studyLevel ?? '')
  const [courses, setCourses] = useState<string[]>(initial.courses ?? [])
  const [courseInput, setCourseInput] = useState('')
  const [mathTopics, setMathTopics] = useState<string[]>(initial.mathTopics ?? [])

  const addCourse = (raw: string) => {
    const t = raw.trim().replace(/,$/, '').trim()
    if (t && !courses.includes(t)) {
      setCourses((p) => [...p, t])
      setCourseInput('')
      setTimeout(() => onChange({ university, studyLevel, courses: [...courses, t], mathTopics }), 0)
    }
  }

  const removeCourse = (c: string) => {
    setCourses((p) => p.filter((x) => x !== c))
    setTimeout(() => onChange({ university, studyLevel, courses: courses.filter((x) => x !== c), mathTopics }), 0)
  }

  const toggleTopic = (t: string) => {
    const next = mathTopics.includes(t) ? mathTopics.filter((x) => x !== t) : [...mathTopics, t]
    setMathTopics(next)
    onChange({ university, studyLevel, courses, mathTopics: next })
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="onboarding-card" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px' }}>
          <span>🏫</span> University or institution <span style={{ color: 'var(--primary)' }}>*</span>
        </label>
        <UniversitySelect
          value={university}
          onChange={(v) => {
            setUniversity(v)
            onChange({ university: v.trim() || undefined, studyLevel, courses, mathTopics })
          }}
          onBlur={() => onChange({ university: university.trim() || undefined, studyLevel, courses, mathTopics })}
          placeholder="Search or type your university…"
        />
      </div>

      <div className="onboarding-card" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px' }}>
          <span>📖</span> Study level <span style={{ color: 'var(--primary)' }}>*</span>
        </label>
        <select
          value={studyLevel}
          onChange={(e) => {
            setStudyLevel(e.target.value)
            onChange({ university, studyLevel: e.target.value || undefined, courses, mathTopics })
          }}
          style={inputStyle}
        >
          {STUDY_LEVELS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px' }}>
          Course(s) you’re taking
        </label>
        <input
          type="text"
          value={courseInput}
          onChange={(e) => setCourseInput(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCourse(courseInput) }
          }}
          onBlur={() => addCourse(courseInput)}
          placeholder="Type and press Enter or comma to add"
          style={inputStyle}
        />
        {courses.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            {courses.map((c) => (
              <span
                key={c}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary)',
                  color: 'var(--primary-text)',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {c}
                <button
                  type="button"
                  onClick={() => removeCourse(c)}
                  aria-label={`Remove ${c}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: '1rem' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="onboarding-card" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '8px' }}>
          <span>📐</span> Math topics you want to focus on <span style={{ color: 'var(--primary)' }}>*</span> <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(pick at least one)</span>
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {MATH_TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTopic(t)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: `1.5px solid ${mathTopics.includes(t) ? 'var(--primary)' : 'var(--border)'}`,
                background: mathTopics.includes(t) ? 'var(--primary-bg)' : 'var(--surface)',
                color: mathTopics.includes(t) ? 'var(--primary)' : 'var(--text)',
                fontSize: '0.9rem',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              {TOPIC_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
