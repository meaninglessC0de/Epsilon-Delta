import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

type ToastMessage = string

interface ContextValue {
  showProgress: (message: ToastMessage) => void
}

const DevelopmentProgressContext = createContext<ContextValue | null>(null)

/** Minimum ms between toasts of the same type to avoid annoyance */
const THROTTLE_MS = 25000

export function DevelopmentProgressProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastShownRef = useRef(0)

  const showProgress = useCallback((msg: ToastMessage) => {
    const now = Date.now()
    if (now - lastShownRef.current < THROTTLE_MS) return
    lastShownRef.current = now

    if (timerRef.current) clearTimeout(timerRef.current)
    setMessage(msg)
    timerRef.current = setTimeout(() => {
      setMessage(null)
      timerRef.current = null
    }, 3500)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <DevelopmentProgressContext.Provider value={{ showProgress }}>
      {children}
      {message && (
        <div
          className="development-progress-toast"
          role="status"
          aria-live="polite"
        >
          <span className="development-progress-toast__icon">✦</span>
          <span>{message}</span>
        </div>
      )}
    </DevelopmentProgressContext.Provider>
  )
}

export function useDevelopmentProgress() {
  const ctx = useContext(DevelopmentProgressContext)
  return ctx?.showProgress ?? (() => {})
}
