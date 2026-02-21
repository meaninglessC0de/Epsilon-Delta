import type { ReactNode } from 'react'

const TOTAL_STEPS = 5

interface OnboardingLayoutProps {
  step: number
  title: string
  subtitle?: string
  children: ReactNode
  onNext: () => void
  onBack?: () => void
  nextLabel?: string
  loading?: boolean
  nextDisabled?: boolean
  validationHint?: string
}

export function OnboardingLayout({
  step,
  title,
  subtitle,
  children,
  onNext,
  onBack,
  nextLabel = 'Continue',
  loading = false,
  nextDisabled = false,
  validationHint,
}: OnboardingLayoutProps) {
  const stepIcons = ['👋', '📚', '✨', '🎯', '♿']

  return (
    <div
      className="onboarding-layout"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 20px 40px',
        background: 'var(--bg)',
      }}
    >
      {/* Progress with icons */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '28px',
          width: '100%',
          maxWidth: '560px',
        }}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '1.1rem', opacity: i <= step ? 1 : 0.4, transition: 'opacity var(--transition)' }}>
              {stepIcons[i]}
            </span>
            <div
              className={i <= step ? 'onboarding-progress-segment--filled' : ''}
              style={{
                width: '100%',
                height: '4px',
                borderRadius: 2,
                background: i <= step ? 'var(--primary)' : 'var(--border)',
                transition: 'background var(--transition)',
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: '560px', flex: 1 }} className="onboarding-content">
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: subtitle ? '8px' : '28px',
            textAlign: 'center',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              color: 'var(--text-2)',
              fontSize: '1rem',
              textAlign: 'center',
              marginBottom: '28px',
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}

        {children}

        {validationHint && (
          <p style={{ color: 'var(--warning)', fontSize: '0.9rem', marginTop: '16px', textAlign: 'center' }}>
            {validationHint}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: onBack ? 'space-between' : 'flex-end',
            marginTop: '32px',
          }}
        >
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              style={{
                padding: '12px 24px',
                borderRadius: 'var(--radius-sm)',
                border: '1.5px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '1rem',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={loading || nextDisabled}
            style={{
              padding: '12px 28px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: loading || nextDisabled ? 'var(--border)' : 'var(--primary)',
              color: loading || nextDisabled ? 'var(--text-3)' : 'var(--primary-text)',
              fontSize: '1rem',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              cursor: loading || nextDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Saving…' : nextLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
