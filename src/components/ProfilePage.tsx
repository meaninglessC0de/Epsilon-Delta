import { useState, useEffect, useCallback } from 'react'
import type { User } from '../types'
import type { UserMetadata } from '../../shared/types'
import { getUserMetadata } from '../lib/firebaseMetadata'
import { updateProfile } from '../lib/auth'
import { DEFAULT_ELO } from '../../shared/metadataSchema'

interface Props {
  user: User
  onBack: () => void
}

export function ProfilePage({ user, onBack }: Props) {
  const [meta, setMeta] = useState<UserMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    university: '',
    studyLevel: '',
    courses: [] as string[],
    mathTopics: [] as string[],
    learningStyle: '' as UserMetadata['learningStyle'],
    tonePreference: '' as UserMetadata['tonePreference'],
    contentEngagement: '' as UserMetadata['contentEngagement'],
  })

  const load = useCallback(async () => {
    const m = await getUserMetadata(user.id)
    setMeta(m ?? null)
    if (m) {
      setForm({
        university: m.university ?? '',
        studyLevel: m.studyLevel ?? '',
        courses: m.courses ?? [],
        mathTopics: m.mathTopics ?? [],
        learningStyle: m.learningStyle ?? 'unsure',
        tonePreference: m.tonePreference ?? 'unsure',
        contentEngagement: m.contentEngagement ?? 'unsure',
      })
    }
    setLoading(false)
  }, [user.id])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!meta || saving) return
    setSaving(true)
    try {
      await updateProfile({
        university: form.university || undefined,
        studyLevel: form.studyLevel || undefined,
        courses: form.courses.length ? form.courses : undefined,
        mathTopics: form.mathTopics.length ? form.mathTopics : undefined,
        learningStyle: form.learningStyle === 'unsure' ? undefined : form.learningStyle,
        tonePreference: form.tonePreference === 'unsure' ? undefined : form.tonePreference,
        contentEngagement: form.contentEngagement === 'unsure' ? undefined : form.contentEngagement,
      })
      await load()
      setEditing(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const eloEntries = meta?.topicElo ? Object.entries(meta.topicElo).filter(([, v]) => v !== DEFAULT_ELO) : []
  const displayName = meta?.name ?? user.name ?? user.email.split('@')[0]

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--border)',
    fontSize: '1rem',
    background: 'var(--bg)',
    color: 'var(--text)',
    width: '100%',
  }

  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 6, fontSize: '0.9rem', color: 'var(--text-2)' }

  return (
    <div className="profile-page">
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← Back</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-2)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section style={{ padding: 24, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 16 }}>Profile</h2>
            <p><strong>Name:</strong> {displayName}</p>
            <p><strong>Email:</strong> {user.email}</p>
          </section>

          <section style={{ padding: 24, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Preferences</h2>
              {!editing ? (
                <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>Edit</button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
                  <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              )}
            </div>

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>University</label>
                  <input type="text" value={form.university} onChange={(e) => setForm((f) => ({ ...f, university: e.target.value }))} style={inputStyle} placeholder="e.g. MIT" />
                </div>
                <div>
                  <label style={labelStyle}>Study level</label>
                  <select value={form.studyLevel} onChange={(e) => setForm((f) => ({ ...f, studyLevel: e.target.value }))} style={inputStyle}>
                    <option value="">Select</option>
                    <option value="undergraduate">Undergraduate</option>
                    <option value="postgraduate">Postgraduate</option>
                    <option value="masters">Masters</option>
                    <option value="phd">PhD</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Math topics (comma-separated)</label>
                  <input type="text" value={form.mathTopics.join(', ')} onChange={(e) => setForm((f) => ({ ...f, mathTopics: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} style={inputStyle} placeholder="algebra, calculus, linear algebra" />
                </div>
                <div>
                  <label style={labelStyle}>Learning style</label>
                  <select value={form.learningStyle} onChange={(e) => setForm((f) => ({ ...f, learningStyle: e.target.value as UserMetadata['learningStyle'] }))} style={inputStyle}>
                    <option value="unsure">Not set</option>
                    <option value="visual">Visual</option>
                    <option value="auditory">Auditory</option>
                    <option value="reading">Reading</option>
                    <option value="kinesthetic">Kinesthetic</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tone preference</label>
                  <select value={form.tonePreference} onChange={(e) => setForm((f) => ({ ...f, tonePreference: e.target.value as UserMetadata['tonePreference'] }))} style={inputStyle}>
                    <option value="unsure">Not set</option>
                    <option value="funny_light">Funny & light</option>
                    <option value="balanced">Balanced</option>
                    <option value="serious_technical">Serious & technical</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Content engagement</label>
                  <select value={form.contentEngagement} onChange={(e) => setForm((f) => ({ ...f, contentEngagement: e.target.value as UserMetadata['contentEngagement'] }))} style={inputStyle}>
                    <option value="unsure">Not set</option>
                    <option value="short_bites">Short bites</option>
                    <option value="deep_dives">Deep dives</option>
                    <option value="examples_first">Examples first</option>
                    <option value="theory_first">Theory first</option>
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-2)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                <p><strong>University:</strong> {meta?.university || '—'}</p>
                <p><strong>Study level:</strong> {meta?.studyLevel || '—'}</p>
                <p><strong>Math topics:</strong> {meta?.mathTopics?.length ? meta.mathTopics.join(', ') : '—'}</p>
                <p><strong>Learning style:</strong> {meta?.learningStyle && meta.learningStyle !== 'unsure' ? meta.learningStyle.replace(/_/g, ' ') : '—'}</p>
                <p><strong>Tone preference:</strong> {meta?.tonePreference && meta.tonePreference !== 'unsure' ? meta.tonePreference.replace(/_/g, ' ') : '—'}</p>
                <p><strong>Content engagement:</strong> {meta?.contentEngagement && meta.contentEngagement !== 'unsure' ? meta.contentEngagement.replace(/_/g, ' ') : '—'}</p>
              </div>
            )}
          </section>

          {eloEntries.length > 0 && (
            <section style={{ padding: 24, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 16 }}>Skill levels</h2>
              <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: 12 }}>Your estimated strength by topic (used for difficulty).</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {eloEntries.map(([topic, elo]) => (
                  <span key={topic} style={{ padding: '6px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    {topic.replace(/_/g, ' ')}: {elo}
                  </span>
                ))}
              </div>
            </section>
          )}

          {meta?.recentInputs && meta.recentInputs.length > 0 && (
            <section style={{ padding: 24, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 16 }}>Recent activity</h2>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: 1.8 }}>
                {meta.recentInputs.slice(-10).reverse().map((r, i) => (
                  <li key={i}><strong>{r.type}:</strong> {r.content.slice(0, 100)}{r.content.length > 100 ? '…' : ''}</li>
                ))}
              </ul>
            </section>
          )}

          <p style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>
            To update preference scores (length, engagement, approach, etc.), complete onboarding again from the beginning.
          </p>
        </div>
      )}
    </div>
  )
}
