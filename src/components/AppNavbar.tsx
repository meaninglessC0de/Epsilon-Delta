import type { User } from '../types'
import { useTheme } from '../lib/theme'
import logoImg from '../assets/logo.png'

interface AppNavbarProps {
  user: User | null
  onLogout: () => void
  onHome?: () => void
}

export function AppNavbar({ user, onLogout, onHome }: AppNavbarProps) {
  const initial = user?.email?.[0]?.toUpperCase() ?? '?'
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="app-navbar">
      <span
        className="app-navbar__logo"
        onClick={onHome}
        role={onHome ? 'button' : undefined}
        tabIndex={onHome ? 0 : undefined}
        onKeyDown={onHome ? (e) => e.key === 'Enter' && onHome() : undefined}
      >
        <img src={logoImg} alt="Epsilon-Delta" className="app-navbar__logo-img" />
      </span>
      <div className="app-navbar__user">
        <button
          className="btn btn--ghost btn--sm"
          onClick={toggleTheme}
          type="button"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {user && (
          <>
            <div className="app-navbar__avatar" aria-hidden="true">
              {initial}
            </div>
            <span className="app-navbar__email" title={user.email}>
              {user.email}
            </span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={onLogout}
              type="button"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  )
}
