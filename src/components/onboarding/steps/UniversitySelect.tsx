import { useState, useEffect, useRef, useCallback } from 'react'
import { getUniversityList, filterUniversities, type UniversityEntry } from '../../../lib/universityList'

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

interface UniversitySelectProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
}

function formatOption(u: UniversityEntry): string {
  return u.country ? `${u.name} (${u.country})` : u.name
}

export function UniversitySelect({ value, onChange, onBlur, placeholder }: UniversitySelectProps) {
  const [list, setList] = useState<UniversityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getUniversityList().then((l) => {
      setList(l)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    setQuery(value)
  }, [value])

  const options = filterUniversities(list, query, 80)
  const showDropdown = open && (query.length >= 1 || options.length > 0)

  const close = useCallback(() => {
    setOpen(false)
    setHighlight(0)
    onBlur?.()
  }, [onBlur])

  useEffect(() => {
    if (!showDropdown) return
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showDropdown, close])

  const handleSelect = (u: UniversityEntry) => {
    const str = formatOption(u)
    onChange(str)
    setQuery(str)
    setOpen(false)
    setHighlight(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'ArrowDown' && query.length >= 1) setOpen(true)
      return
    }
    if (e.key === 'Escape') {
      close()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h < options.length - 1 ? h + 1 : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h > 0 ? h - 1 : options.length - 1))
      return
    }
    if (e.key === 'Enter' && options[highlight]) {
      e.preventDefault()
      handleSelect(options[highlight])
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value.trim() || '')
          setOpen(true)
          setHighlight(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(close, 150)}
        onKeyDown={handleKeyDown}
        placeholder={loading ? 'Loading list…' : placeholder}
        autoComplete="off"
        style={inputStyle}
        aria-autocomplete="list"
        aria-expanded={showDropdown}
      />
      {showDropdown && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            margin: 0,
            marginTop: '4px',
            padding: 0,
            listStyle: 'none',
            maxHeight: '280px',
            overflowY: 'auto',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow)',
            zIndex: 10,
          }}
        >
          {options.length === 0 ? (
            <li style={{ padding: '12px 14px', color: 'var(--text-3)', fontSize: '0.9rem' }}>
              No matches. You can type your institution name.
            </li>
          ) : (
            options.map((u, i) => {
              const str = formatOption(u)
              return (
                <li
                  key={`${u.name}-${u.country}-${i}`}
                  role="option"
                  aria-selected={i === highlight}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(u)
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    background: i === highlight ? 'var(--primary-bg)' : 'transparent',
                    color: 'var(--text)',
                  }}
                >
                  {str}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
