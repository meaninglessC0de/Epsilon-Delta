export function WelcomeStep() {
  return (
    <div
      className="onboarding-card"
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: '32px 28px',
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: '2rem', marginBottom: '12px' }}>✨</p>
      <p style={{ color: 'var(--text-2)', fontSize: '1.05rem', lineHeight: 1.6 }}>
        We’ll ask a few questions so we can tailor problems, feedback, and explanations to you.
        You can skip or change answers later.
      </p>
    </div>
  )
}
