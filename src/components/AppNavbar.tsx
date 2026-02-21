import type { User } from '../types'

interface AppNavbarProps {
  user: User | null
  onLogout: () => void
  onHome?: () => void
}

export function AppNavbar({ user, onLogout, onHome }: AppNavbarProps) {
  const initial = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="app-navbar">
      <span
        className="app-navbar__logo"
        onClick={onHome}
        role={onHome ? 'button' : undefined}
        tabIndex={onHome ? 0 : undefined}
        onKeyDown={onHome ? (e) => e.key === 'Enter' && onHome() : undefined}
      >
        Epsilon-Delta
      </span>
      {user && (
        <div className="app-navbar__user">
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
        </div>
      )}
    </header>
  )
}
