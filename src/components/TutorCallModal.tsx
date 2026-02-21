import { useState, useEffect, useRef, useCallback } from 'react'
import { chatWithTutor, type TutorMessage } from '../lib/claude'
import { speakText, stopSpeaking } from '../lib/elevenlabs'
import { getMemory, getMetadataForAgent } from '../lib/memory'
import type { User, Solve, AgentMemory } from '../types'

type Phase = 'idle' | 'listening' | 'processing' | 'speaking'

interface Props {
  user: User
  solves: Solve[]
  onClose: () => void
}

export function TutorCallModal({ user, solves, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const [memory, setMemory] = useState<AgentMemory | null>(null)
  const [interimText, setInterimText] = useState('')
  const [textInput, setTextInput] = useState('')
  const [hasSpeechAPI, setHasSpeechAPI] = useState(true)

  const phaseRef = useRef<Phase>('idle')
  const memoryRef = useRef<AgentMemory | null>(null)
  const userContextRef = useRef<string>('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isMountedRef = useRef(true)

  const setPhaseSync = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  useEffect(() => { memoryRef.current = memory }, [memory])

  const startListening = useCallback(() => {
    if (!isMountedRef.current) return
    const SpeechRecognition =
      (window as Window & { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ??
      (window as Window & { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setHasSpeechAPI(false)
      setPhaseSync('listening')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-GB'
    recognitionRef.current = recognition

    let gotFinal = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) { final += t; gotFinal = true }
        else interim += t
      }
      if (isMountedRef.current) setInterimText(interim || final)
      if (final && isMountedRef.current) {
        setInterimText('')
        handleUserSpeech(final.trim())
      }
    }

    recognition.onend = () => {
      if (!isMountedRef.current) return
      if (!gotFinal && phaseRef.current === 'listening') {
        // silence — restart
        setTimeout(() => {
          if (isMountedRef.current && phaseRef.current === 'listening') startListening()
        }, 300)
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech' && isMountedRef.current && phaseRef.current === 'listening') {
        setTimeout(() => {
          if (isMountedRef.current && phaseRef.current === 'listening') startListening()
        }, 300)
      }
    }

    setPhaseSync('listening')
    recognition.start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUserSpeech = useCallback(async (text: string) => {
    if (!isMountedRef.current) return
    recognitionRef.current?.abort()

    const userMsg: TutorMessage = { role: 'user', content: text }
    setMessages((prev) => {
      const next = [...prev, userMsg]
      processResponse(next)
      return next
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const processResponse = useCallback(async (msgs: TutorMessage[]) => {
    if (!isMountedRef.current) return
    setPhaseSync('processing')

    try {
      const reply = await chatWithTutor(msgs, {
        userName: user.name ?? user.email.split('@')[0],
        solves: solves.map((s) => ({
          problem: s.problem,
          status: s.status,
          finalFeedback: s.finalFeedback,
        })),
        memory: memoryRef.current
          ? { topicsCovered: memoryRef.current.topicsCovered, weaknesses: memoryRef.current.weaknesses, solveSummaries: memoryRef.current.solveSummaries }
          : undefined,
        userContext: userContextRef.current || undefined,
      })

      if (!isMountedRef.current) return

      const aiMsg: TutorMessage = { role: 'assistant', content: reply }
      setMessages((prev) => [...prev, aiMsg])
      setPhaseSync('speaking')

      const timeout = setTimeout(() => {
        if (isMountedRef.current && phaseRef.current === 'speaking') startListening()
      }, 30000)

      speakText(reply, () => {
        clearTimeout(timeout)
        if (isMountedRef.current && phaseRef.current === 'speaking') startListening()
      }).catch(() => {
        clearTimeout(timeout)
        if (isMountedRef.current) startListening()
      })
    } catch {
      if (isMountedRef.current) startListening()
    }
  }, [user, solves, startListening]) // eslint-disable-line react-hooks/exhaustive-deps

  // Kick off with greeting on mount + fetch memory and metadata context
  useEffect(() => {
    isMountedRef.current = true
    getMemory().then((m) => { if (isMountedRef.current) setMemory(m) }).catch(() => {})
    getMetadataForAgent().then((a) => { if (isMountedRef.current && a) userContextRef.current = a.contextString }).catch(() => {})

    const greeting: TutorMessage = {
      role: 'assistant',
      content: `Hi${user.name ? ' ' + user.name : ''}! What are you working on?`,
    }
    setMessages([greeting])
    setPhaseSync('speaking')

    const timeout = setTimeout(() => {
      if (isMountedRef.current && phaseRef.current === 'speaking') startListening()
    }, 30000)

    speakText(greeting.content, () => {
      clearTimeout(timeout)
      if (isMountedRef.current && phaseRef.current === 'speaking') startListening()
    }).catch(() => {
      clearTimeout(timeout)
      if (isMountedRef.current) startListening()
    })

    return () => {
      isMountedRef.current = false
      recognitionRef.current?.abort()
      stopSpeaking()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleEndCall() {
    stopSpeaking()
    recognitionRef.current?.abort()
    onClose()
  }

  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = textInput.trim()
    if (!text || phase === 'processing') return
    setTextInput('')
    handleUserSpeech(text)
  }

  const phaseLabel =
    phase === 'listening' ? 'Listening…'
    : phase === 'processing' ? 'Thinking…'
    : phase === 'speaking' ? 'Speaking…'
    : 'Starting…'

  const avatarClass = [
    'tutor-avatar',
    phase === 'listening' ? 'tutor-avatar--listen' : '',
    phase === 'processing' ? 'tutor-avatar--think' : '',
    phase === 'speaking' ? 'tutor-avatar--speak' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="tutor-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleEndCall() }}>
      <div className="tutor-card">
        {/* Header */}
        <div className="tutor-card__header">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text)' }}>
            Epsilon-Delta Tutor
          </span>
          <button className="btn btn--ghost btn--sm" onClick={handleEndCall}>
            End call
          </button>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className={avatarClass}>εδ</div>
          <p className="tutor-status">{phaseLabel}</p>
        </div>

        {/* Interim speech preview */}
        <p className="tutor-interim">{interimText || '\u00A0'}</p>

        {/* Text input fallback */}
        {(!hasSpeechAPI || phase === 'listening') && (
          <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={hasSpeechAPI ? 'Or type here…' : 'Type your message…'}
              disabled={phase === 'processing'}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1.5px solid var(--border)',
                fontSize: '0.9rem',
                fontFamily: 'var(--font-body)',
                background: 'var(--bg)',
                color: 'var(--text)',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={phase === 'processing' || !textInput.trim()}
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
