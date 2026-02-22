import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  chatWithTutorStructured,
  tutorAskQuestion,
  evaluateAnswer,
  type TutorMessage,
  type TutorResponse,
  type TutorGraphSpec,
} from '../lib/claude'
import { speakText, stopSpeaking } from '../lib/elevenlabs'
import { getMemory, getMetadataForAgent } from '../lib/memory'
import { getSolves } from '../lib/storage'
import type { User, Solve, AgentMemory } from '../types'
import { ChatGraphVisual } from './ChatGraphVisual'
import confetti from 'canvas-confetti'

const FAMOUS_MATHEMATICIANS = [
  'Euler', 'Gauss', 'Riemann', 'Fermat', 'Pascal', 'Descartes', 'Leibniz', 'Newton',
  'Archimedes', 'Euclid', 'Pythagoras', 'Hypatia', 'Cantor', 'Noether', 'Lovelace',
  'Turing', 'Shannon', 'Gödel', 'Poincaré', 'Ramanujan', 'Laplace', 'Lagrange',
  'Cauchy', 'Bernoulli', 'Galois', 'Abel', 'Diophantus', 'al-Khwarizmi', 'Bhaskara',
  'Kovalevskaya', 'Germain', 'Dedekind', 'Hilbert', 'Kolmogorov', 'von Neumann',
  'Euclid', 'Ptolemy', 'Fibonacci', 'Cardano', 'Viète', 'Brahmagupta', 'Omar Khayyam',
  'Tartaglia', 'Bombelli', 'Napier', 'Kepler', 'Galileo', 'Cavalieri', 'Fermat',
  'Wallis', 'Brouwer', 'Hausdorff', 'Lebesgue', 'Borel', 'Banach', 'Bourbaki',
]

function getMathematicianForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash << 5) - hash + userId.charCodeAt(i)
  return FAMOUS_MATHEMATICIANS[Math.abs(hash) % FAMOUS_MATHEMATICIANS.length]
}

type Phase = 'idle' | 'listening' | 'processing' | 'speaking' | 'awaiting_answer'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  isQuestion?: boolean
  equation?: string
  graph?: TutorGraphSpec
}

interface Props {
  user: User
  onBack: () => void
}

export function ChatPage({ user, onBack }: Props) {
  const navigate = useNavigate()
  const [solves, setSolves] = useState<Solve[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [memory, setMemory] = useState<AgentMemory | null>(null)
  const [interimText, setInterimText] = useState('')
  const [hasSpeechAPI, setHasSpeechAPI] = useState(true)
  const [askingQuestion, setAskingQuestion] = useState(false)

  const phaseRef = useRef<Phase>('idle')
  const memoryRef = useRef<AgentMemory | null>(null)
  const userContextRef = useRef<string>('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isMountedRef = useRef(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

  const mathematician = getMathematicianForUser(user.id)
  const setPhaseSync = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  useEffect(() => { memoryRef.current = memory }, [memory])

  useEffect(() => {
    getSolves().then(setSolves).catch(() => {})
  }, [])

  const tutorContext = useCallback(
    () => ({
      userName: user.name ?? user.email.split('@')[0],
      solves: solves.map((s) => ({
        problem: s.problem,
        status: s.status,
        finalFeedback: s.finalFeedback,
      })),
      memory: memoryRef.current
        ? {
            topicsCovered: memoryRef.current.topicsCovered,
            weaknesses: memoryRef.current.weaknesses,
            solveSummaries: memoryRef.current.solveSummaries,
          }
        : undefined,
      userContext: userContextRef.current || undefined,
      mathematicianName: mathematician,
    }),
    [user, solves, mathematician]
  )

  const toTutorMessages = useCallback((msgs: ChatMessage[]): TutorMessage[] => {
    return msgs.map((m) => ({ role: m.role, content: m.content }))
  }, [])

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
        if (event.results[i].isFinal) {
          final += t
          gotFinal = true
        } else interim += t
      }
      if (isMountedRef.current) setInterimText(interim || final)
      if (final && isMountedRef.current) {
        setInterimText('')
        handleUserInput(final.trim())
      }
    }

    recognition.onend = () => {
      if (!isMountedRef.current) return
      if (!gotFinal && phaseRef.current === 'listening') {
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
  }, [setPhaseSync])

  const handleUserInput = useCallback(
    async (text: string) => {
      if (!isMountedRef.current) return
      recognitionRef.current?.abort()

      const userMsg: ChatMessage = { role: 'user', content: text }
      const nextForApi = [...messagesRef.current, userMsg]
      setMessages((prev) => [...prev, userMsg])

      const lastAssistant = messagesRef.current.filter((m) => m.role === 'assistant').pop()
      const wasAnsweringQuestion = !!lastAssistant?.isQuestion

      setPhaseSync('processing')
      try {
        if (wasAnsweringQuestion) {
          const convBeforeAnswer = messagesRef.current
          const evalRes = await evaluateAnswer(toTutorMessages(convBeforeAnswer), text, tutorContext())
          if (!isMountedRef.current) return

          const feedbackMsg: ChatMessage = { role: 'assistant', content: evalRes.content }
          setMessages((prev) => [...prev, feedbackMsg])

          if (evalRes.correct) {
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } })
          }

          setPhaseSync('speaking')
          const timeout = setTimeout(() => {
            if (isMountedRef.current && phaseRef.current === 'speaking') startListening()
          }, 30000)
          speakText(evalRes.speak, () => {
            clearTimeout(timeout)
            if (isMountedRef.current && phaseRef.current === 'speaking') startListening()
          }).catch(() => {
            clearTimeout(timeout)
            if (isMountedRef.current) startListening()
          })
        } else {
          const res: TutorResponse = await chatWithTutorStructured(toTutorMessages(nextForApi), tutorContext())
          if (!isMountedRef.current) return

          const aiMsg: ChatMessage = {
            role: 'assistant',
            content: res.content,
            isQuestion: res.isQuestion,
            equation: res.equation,
            graph: res.graph,
          }
          setMessages((prev) => [...prev, aiMsg])

          if (res.isQuestion) {
            setPhaseSync('speaking')
            const timeout = setTimeout(() => {
              if (isMountedRef.current && phaseRef.current === 'speaking') setPhaseSync('awaiting_answer')
            }, 30000)
            speakText(res.speak, () => {
              clearTimeout(timeout)
              if (isMountedRef.current && phaseRef.current === 'speaking') setPhaseSync('awaiting_answer')
            }).catch(() => {
              clearTimeout(timeout)
              if (isMountedRef.current) setPhaseSync('awaiting_answer')
            })
          } else {
            setPhaseSync('speaking')
            const timeout = setTimeout(() => {
              if (isMountedRef.current && phaseRef.current === 'speaking') startListening()
            }, 30000)
            speakText(res.speak, () => {
              clearTimeout(timeout)
              if (isMountedRef.current && phaseRef.current === 'speaking') startListening()
            }).catch(() => {
              clearTimeout(timeout)
              if (isMountedRef.current) startListening()
            })
          }
        }
      } catch {
        if (isMountedRef.current) setPhaseSync(wasAnsweringQuestion ? 'awaiting_answer' : 'idle')
      }
    },
    [tutorContext, toTutorMessages, setPhaseSync, startListening]
  )

  const handleAskQuestion = useCallback(async () => {
    if (messagesRef.current.length === 0 || phase === 'processing' || askingQuestion) return
    recognitionRef.current?.abort()
    setAskingQuestion(true)
    setPhaseSync('processing')
    try {
      const question = await tutorAskQuestion(toTutorMessages(messagesRef.current), tutorContext())
      if (!isMountedRef.current) return
      setMessages((prev) => [...prev, { role: 'assistant', content: question, isQuestion: true }])
      setPhaseSync('speaking')
      const timeout = setTimeout(() => {
        if (isMountedRef.current && phaseRef.current === 'speaking') setPhaseSync('awaiting_answer')
      }, 30000)
      speakText(question, () => {
        clearTimeout(timeout)
        if (isMountedRef.current && phaseRef.current === 'speaking') setPhaseSync('awaiting_answer')
      }).catch(() => {
        clearTimeout(timeout)
        if (isMountedRef.current) setPhaseSync('awaiting_answer')
      })
    } catch {
      if (isMountedRef.current) setPhaseSync('idle')
    } finally {
      if (isMountedRef.current) setAskingQuestion(false)
    }
  }, [phase, askingQuestion, tutorContext, toTutorMessages, setPhaseSync])

  const handleGenerateVideo = useCallback(() => {
    const summary = messages.length
      ? messages
          .filter((m) => m.content)
          .slice(-6)
          .map((m) => (m.role === 'user' ? `Student: ${m.content}` : `Tutor: ${m.content}`))
          .join('\n')
      : ''
    stopSpeaking()
    recognitionRef.current?.abort()
    navigate('/manim', { state: { fromChat: true, suggestedQuestion: summary || undefined } })
  }, [messages, navigate])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleEndConversation = useCallback(() => {
    stopSpeaking()
    recognitionRef.current?.abort()
    onBack()
  }, [onBack])

  useEffect(() => {
    isMountedRef.current = true
    getMemory().then((m) => { if (isMountedRef.current) setMemory(m) }).catch(() => {})
    getMetadataForAgent().then((a) => { if (isMountedRef.current && a) userContextRef.current = a.contextString }).catch(() => {})

    const greetingContent = `Hi${user.name ? ' ' + user.name : ''}! I'm ${mathematician}. What would you like to work on?`
    const greeting: ChatMessage = { role: 'assistant', content: 'Say what you’d like to work on — I’m listening.' }
    setMessages([greeting])
    setPhaseSync('speaking')

    const timeout = setTimeout(() => {
      if (isMountedRef.current && phaseRef.current === 'speaking') startListening()
    }, 30000)

    speakText(greetingContent, () => {
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

  const phaseLabel =
    phase === 'listening' ? 'Listening…'
    : phase === 'processing' ? 'Thinking…'
    : phase === 'speaking' ? 'Speaking…'
    : phase === 'awaiting_answer' ? 'Tap to answer'
    : 'Idle'

  return (
    <div className="chat-page">
      <div className="chat-page__inner">
        <header className="chat-page__header">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
            ← Back
          </button>
          <div>
            <h1 className="chat-page__title">Chat with {mathematician}</h1>
            <p className="chat-page__sub">{phaseLabel}</p>
          </div>
        </header>

        <div ref={listRef} className="chat-page__list">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={
                msg.role === 'user'
                  ? 'chat-msg chat-msg--user'
                  : msg.isQuestion
                    ? 'chat-msg chat-msg--assistant chat-msg--question'
                    : 'chat-msg chat-msg--assistant'
              }
            >
              <p className="chat-msg__content">{msg.content}</p>
              {msg.role === 'assistant' && msg.equation && (
                <div className="chat-msg__equation" aria-label="Equation">
                  {msg.equation}
                </div>
              )}
              {msg.role === 'assistant' && msg.graph && (
                <ChatGraphVisual spec={msg.graph} />
              )}
            </div>
          ))}
          {interimText && (
            <div className="chat-msg chat-msg--user chat-msg--interim">
              <p className="chat-msg__content">{interimText}</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {!hasSpeechAPI && (
          <p className="chat-page__voice-only-hint">
            Voice only — please use a browser that supports speech input (e.g. Chrome) to talk.
          </p>
        )}

        {phase === 'awaiting_answer' && hasSpeechAPI && (
          <button
            type="button"
            className="btn btn--primary chat-page__answer-btn"
            onClick={() => startListening()}
          >
            Tap to answer
          </button>
        )}

        <div className="chat-page__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleAskQuestion}
            disabled={!messages.some((m) => m.role === 'user') || phase === 'processing' || askingQuestion}
          >
            Ask me a question
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleGenerateVideo}
          >
            Generate video explanation
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleEndConversation}
          >
            End conversation
          </button>
        </div>
      </div>
    </div>
  )
}
