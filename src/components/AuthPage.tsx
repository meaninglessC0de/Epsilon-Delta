import { useState } from 'react'
import { register, login, loginWithGoogle } from '../lib/auth'
import type { User } from '../types'
import { WhiteboardBackground } from './WhiteboardBackground'
import logoImg from '../assets/logo.png'

interface Props {
  onSuccess: (data: { user: User; onboardingComplete: boolean }) => void
}

export function AuthPage({ onSuccess }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogleSignIn() {
    setError(null)
    setGoogleLoading(true)
    try {
      const data = await loginWithGoogle()
      onSuccess({ user: data.user, onboardingComplete: data.onboardingComplete })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const data = mode === 'signup'
        ? await register(email.trim(), password, name.trim() || undefined)
        : await login(email.trim(), password)
      onSuccess({ user: data.user, onboardingComplete: data.onboardingComplete })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      isolation: 'isolate',
    }}>
      <WhiteboardBackground />
      <div style={{
        width: '100%',
        maxWidth: '420px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo / heading */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img
            src={logoImg}
            alt="Epsilon-Delta"
            className="auth-logo"
            style={{ display: 'block', margin: '0 auto 16px', maxWidth: '180px', height: 'auto' }}
          />
          <p style={{ color: 'var(--text-2)', fontSize: '1rem' }}>
            {mode === 'signin' ? 'Welcome back — sign in to continue.' : 'Create your account to get started.'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          padding: '36px 32px',
        }}>
          {/* Mode toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-alt)',
            borderRadius: 'var(--radius)',
            padding: '4px',
            marginBottom: '28px',
            gap: '4px',
          }}>
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 'calc(var(--radius) - 2px)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  transition: 'var(--transition)',
                  background: mode === m ? 'var(--surface)' : 'transparent',
                  color: mode === m ? 'var(--text)' : 'var(--text-3)',
                  boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {/* Google sign-in — centered, smaller */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-sm)',
                border: '1.5px solid var(--border)',
                cursor: loading || googleLoading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                background: 'var(--bg)',
                color: 'var(--text)',
                transition: 'border-color var(--transition), background var(--transition)',
              }}
              onMouseOver={(e) => {
                if (!loading && !googleLoading) {
                  e.currentTarget.style.borderColor = 'var(--text-3)'
                  e.currentTarget.style.background = 'var(--bg-alt)'
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'var(--bg)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {googleLoading ? 'Please wait…' : 'Continue with Google'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mode === 'signup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-2)' }}>
                  Your name <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex"
                  autoComplete="given-name"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border)',
                    fontSize: '1rem',
                    fontFamily: 'var(--font-body)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    outline: 'none',
                    transition: 'border-color var(--transition)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-2)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--border)',
                  fontSize: '1rem',
                  fontFamily: 'var(--font-body)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  outline: 'none',
                  transition: 'border-color var(--transition)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-2)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--border)',
                  fontSize: '1rem',
                  fontFamily: 'var(--font-body)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  outline: 'none',
                  transition: 'border-color var(--transition)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-bg)',
                border: '1px solid #fecaca',
                color: 'var(--danger)',
                fontSize: '0.9rem',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '4px',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: 700,
                fontFamily: 'var(--font-body)',
                background: loading ? 'var(--border)' : 'var(--primary)',
                color: loading ? 'var(--text-3)' : 'var(--primary-text)',
                transition: 'background var(--transition)',
              }}
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
