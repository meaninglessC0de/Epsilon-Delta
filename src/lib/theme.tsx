import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'epsilon-delta-theme'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getStoredTheme(): Theme {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s === 'dark' || s === 'light') return s
  } catch {}
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {}
  }, [theme])

  const setTheme = (t: Theme) => setThemeState(t)
  const toggleTheme = () => setThemeState((t) => (t === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: 'light' as Theme,
      setTheme: () => {},
      toggleTheme: () => {},
    }
  }
  return ctx
}

/** Floating theme toggle — visible on all pages (auth, onboarding, app). */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      className="theme-toggle-fixed"
      onClick={toggleTheme}
      type="button"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
