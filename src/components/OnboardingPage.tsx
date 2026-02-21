import { useState, KeyboardEvent } from 'react'
import type { User } from '../types'
import { updateProfile } from '../lib/auth'

interface OnboardingPageProps {
  user: User
  onComplete: () => void
}

const PREF_OPTIONS: { key: string; label: string }[] = [
  { key: 'hintsFirst', label: 'Give hints before revealing answers' },
  { key: 'stepByStep', label: 'Step-by-step explanations' },
  { key: 'workedExamples', label: 'Worked examples when stuck' },
  { key: 'intuition', label: 'Build intuition over procedure' },
]

const STUDY_LEVELS = [
  { value: '', label: 'Select...' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'postgraduate', label: 'Postgraduate' },
  { value: 'other', label: 'Other' },
]

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
  transition: 'border-color var(--transition)',
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [university, setUniversity] = useState('')
  const [studyLevel, setStudyLevel] = useState('')
  const [courses, setCourses] = useState<string[]>([])
  const [courseInput, setCourseInput] = useState('')
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    hintsFirst: false,
    stepByStep: false,
    workedExamples: false,
    intuition: false,
  })
  const [saving, setSaving] = useState(false)

  function addCourse(raw: string) {
    const trimmed = raw.trim().replace(/,$/, '').trim()
    if (trimmed && !courses.includes(trimmed)) {
      setCourses((prev) => [...prev, trimmed])
    }
    setCourseInput('')
  }

  function handleCourseKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addCourse(courseInput)
    }
  }

  function removeCourse(course: string) {
    setCourses((prev) => prev.filter((c) => c !== course))
  }

  function togglePref(key: string) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateProfile({
        university: university.trim() || undefined,
        studyLevel: studyLevel || undefined,
        courses,
        learningPrefs: prefs,
      })
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    setSaving(true)
    try {
      await updateProfile({})
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.2rem',
            fontWeight: 400,
            color: 'var(--text)',
            marginBottom: '8px',
          }}>
            Welcome to Epsilon-Delta
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '1rem' }}>
            Let&apos;s personalise your experience
          </p>
        </div>

        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {/* University */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="ob-university">
              University / Institution
            </label>
            <input
              id="ob-university"
              type="text"
              style={inputStyle}
              placeholder="e.g. Imperial College London"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Study level */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="ob-level">
              Study level
            </label>
            <select
              id="ob-level"
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={studyLevel}
              onChange={(e) => setStudyLevel(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            >
              {STUDY_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Courses */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="ob-courses">
              Your courses
            </label>
            <input
              id="ob-courses"
              type="text"
              style={inputStyle}
              placeholder="Add a course — press Enter or comma to add"
              value={courseInput}
              onChange={(e) => {
                const v = e.target.value
                if (v.endsWith(',')) {
                  addCourse(v)
                } else {
                  setCourseInput(v)
                }
              }}
              onKeyDown={handleCourseKeyDown}
              onBlur={() => courseInput.trim() && addCourse(courseInput)}
              onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
            />
            {courses.length > 0 && (
              <div className="onboarding-tags">
                {courses.map((c) => (
                  <span key={c} className="onboarding-tag">
                    {c}
                    <span
                      className="onboarding-tag__remove"
                      onClick={() => removeCourse(c)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${c}`}
                      onKeyDown={(e) => e.key === 'Enter' && removeCourse(c)}
                    >
                      ×
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Learning prefs */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <span className="form-label">How you learn best</span>
            <div>
              {PREF_OPTIONS.map(({ key, label }) => (
                <label key={key} className="onboarding-pref">
                  <input
                    type="checkbox"
                    checked={prefs[key] ?? false}
                    onChange={() => togglePref(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 4 }}>
            <button
              className="btn btn--primary btn--lg"
              onClick={handleSave}
              disabled={saving}
              type="button"
            >
              Save &amp; continue
              <span className="btn__arrow">→</span>
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={handleSkip}
              disabled={saving}
              type="button"
            >
              skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
