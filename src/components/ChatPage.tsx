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
import { recordUserInput } from '../lib/firebaseMetadata'
import { auth } from '../lib/firebase'
import { useDevelopmentProgress } from '../lib/developmentProgressToast'
import { getSolves, getRecentConversations, saveConversation } from '../lib/storage'
import type { User, Solve, AgentMemory } from '../types'
import { ChatGraphVisual } from './ChatGraphVisual'
import { getMathematicianForUser } from '../lib/mathematician'
import confetti from 'canvas-confetti'

/**
 * Two mutually exclusive states:
 * - ai_speaking: TTS playing. Mic OFF. Only TTS callback can transition out.
 * - user_listening: Mic ON. TTS OFF.
 * - processing: API call in progress. Mic OFF.
 * - awaiting_answer: After explicit "Ask me a question". Mic OFF until user taps.
 */
type Phase = 'ai_speaking' | 'user_listening' | 'processing' | 'awaiting_answer'

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
  const [phase, setPhase] = useState<Phase>('ai_speaking')
  const [memory, setMemory] = useState<AgentMemory | null>(null)
  const [previousConversationContext, setPreviousConversationContext] = useState<string>('')
  const [interimText, setInterimText] = useState('')
  const [hasSpeechAPI, setHasSpeechAPI] = useState(true)
  const [askingQuestion, setAskingQuestion] = useState(false)
  const [needsTapToSpeak, setNeedsTapToSpeak] = useState(false)

  const phaseRef = useRef<Phase>('ai_speaking')
  const memoryRef = useRef<AgentMemory | null>(null)
  const previousContextRef = useRef<string>('')
  const userContextRef = useRef<string>('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isMountedRef = useRef(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { memoryRef.current = memory }, [memory])
  useEffect(() => { previousContextRef.current = previousConversationContext }, [previousConversationContext])

  const mathematician = getMathematicianForUser(user.id)
  const showProgress = useDevelopmentProgress()

  const setPhaseSync = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  const stopMic = useCallback(() => {
    recognitionRef.current?.abort()
    recognitionRef.current = null
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
      previousConversationContext: previousContextRef.current || undefined,
      mathematicianName: mathematician,
    }),
    [user, solves, mathematician]
  )

  const toTutorMessages = useCallback((msgs: ChatMessage[]): TutorMessage[] => {
    return msgs.map((m) => ({ role: m.role, content: m.content }))
  }, [])

  const startListening = useCallback(() => {
    if (!isMountedRef.current) return
    if (phaseRef.current === 'ai_speaking' || phaseRef.current === 'processing') return

    const SpeechRecognition =
      (window as Window & { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ??
      (window as Window & { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setHasSpeechAPI(false)
      return
    }

    stopSpeaking()
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
      recognitionRef.current = null
      if (!gotFinal && phaseRef.current === 'user_listening') {
        setTimeout(() => {
          if (isMountedRef.current && phaseRef.current === 'user_listening') startListening()
        }, 300)
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech' && phaseRef.current === 'user_listening') {
        setTimeout(() => {
          if (isMountedRef.current && phaseRef.current === 'user_listening') startListening()
        }, 300)
      }
    }

    setPhaseSync('user_listening')
    setNeedsTapToSpeak(false)
    recognition.start()
  }, [setPhaseSync, stopSpeaking])

  const handleUserInput = useCallback(
    async (text: string) => {
      if (!isMountedRef.current) return
      stopMic()
      if (phaseRef.current === 'ai_speaking' || phaseRef.current === 'processing') return

      const userMsg: ChatMessage = { role: 'user', content: text }
      const nextForApi = [...messagesRef.current, userMsg]
      setMessages((prev) => [...prev, userMsg])

      const uid = auth.currentUser?.uid
      if (uid) recordUserInput(uid, 'chat', text).catch(console.error)

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
            showProgress("We're learning what works for you")
          }

          stopMic()
          setPhaseSync('ai_speaking')
          speakText(evalRes.speak, () => {
            if (!isMountedRef.current) return
            if (phaseRef.current === 'ai_speaking') {
              setPhaseSync('user_listening')
              startListening()
            }
          }).catch(() => {
            if (isMountedRef.current && phaseRef.current === 'ai_speaking') {
              setPhaseSync('user_listening')
              setNeedsTapToSpeak(true)
            }
          })
        } else {
          const res: TutorResponse = await chatWithTutorStructured(toTutorMessages(nextForApi), tutorContext())
          if (!isMountedRef.current) return

          const aiMsg: ChatMessage = {
            role: 'assistant',
            content: res.content,
            equation: res.equation,
            graph: res.graph,
          }
          setMessages((prev) => [...prev, aiMsg])

          stopMic()
          setPhaseSync('ai_speaking')
          const onSpeakDone = () => {
            if (!isMountedRef.current) return
            if (res.openVideo) {
              stopSpeaking()
              navigate('/manim', { state: { fromChat: true, suggestedQuestion: res.openVideo } })
              return
            }
            if (phaseRef.current === 'ai_speaking') {
              setPhaseSync('user_listening')
              startListening()
            }
          }
          speakText(res.speak, onSpeakDone).catch(() => {
            if (!isMountedRef.current) return
            if (res.openVideo) {
              navigate('/manim', { state: { fromChat: true, suggestedQuestion: res.openVideo } })
              return
            }
            if (isMountedRef.current && phaseRef.current === 'ai_speaking') {
              setPhaseSync('user_listening')
              setNeedsTapToSpeak(true)
            }
          })
        }
      } catch {
        if (isMountedRef.current) setPhaseSync(wasAnsweringQuestion ? 'awaiting_answer' : 'user_listening')
        if (phaseRef.current === 'user_listening') setNeedsTapToSpeak(true)
      }
    },
    [tutorContext, toTutorMessages, setPhaseSync, startListening, stopMic, showProgress]
  )

  const handleAskQuestion = useCallback(async () => {
    if (messagesRef.current.length === 0 || phase === 'processing' || askingQuestion) return
    stopMic()
    setAskingQuestion(true)
    setPhaseSync('processing')
    try {
      const question = await tutorAskQuestion(toTutorMessages(messagesRef.current), tutorContext())
      if (!isMountedRef.current) return
      setMessages((prev) => [...prev, { role: 'assistant', content: question, isQuestion: true }])
      stopMic()
      setPhaseSync('ai_speaking')
      speakText(question, () => {
        if (!isMountedRef.current) return
        if (phaseRef.current === 'ai_speaking') setPhaseSync('awaiting_answer')
      }).catch(() => {
        if (isMountedRef.current && phaseRef.current === 'ai_speaking') setPhaseSync('awaiting_answer')
      })
    } catch {
      if (isMountedRef.current) setPhaseSync('awaiting_answer')
    } finally {
      if (isMountedRef.current) setAskingQuestion(false)
    }
  }, [phase, askingQuestion, tutorContext, toTutorMessages, setPhaseSync, stopMic])

  const handleGenerateVideo = useCallback(() => {
    const summary = messages.length
      ? messages
          .filter((m) => m.content)
          .slice(-6)
          .map((m) => (m.role === 'user' ? `Student: ${m.content}` : `Tutor: ${m.content}`))
          .join('\n')
      : ''
    stopSpeaking()
    stopMic()
    navigate('/manim', { state: { fromChat: true, suggestedQuestion: summary || undefined } })
  }, [messages, navigate, stopMic])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleEndConversation = useCallback(async () => {
    stopSpeaking()
    stopMic()
    if (messagesRef.current.some((m) => m.role === 'user')) {
      const toSave = messagesRef.current.map((m) => ({ role: m.role, content: m.content }))
      await saveConversation(toSave).catch(() => {})
    }
    onBack()
  }, [onBack, stopMic])

  useEffect(() => {
    isMountedRef.current = true
    getMemory().then((m) => { if (isMountedRef.current) setMemory(m) }).catch(() => {})
    getMetadataForAgent().then((a) => { if (isMountedRef.current && a) userContextRef.current = a.contextString }).catch(() => {})

    getSolves().then(setSolves).catch(() => {})

    getRecentConversations().then((convs) => {
      if (!isMountedRef.current) return
      if (convs.length === 0) return
      const summary = convs
        .map((c) =>
          c.messages
            .slice(-8)
            .map((m) => (m.role === 'user' ? `Student: ${m.content}` : `Tutor: ${m.content}`))
            .join('; ')
        )
        .join('\n---\n')
      setPreviousConversationContext(summary)
    }).catch(() => {})

    const greetingContent = `Hi${user.name ? ' ' + user.name : ''}! I'm ${mathematician}. What would you like to work on?`
    const greeting: ChatMessage = { role: 'assistant', content: 'Say what you’d like to work on.' }
    setMessages([greeting])
    stopMic()
    setPhaseSync('ai_speaking')

    speakText(greetingContent, () => {
      if (!isMountedRef.current) return
      if (phaseRef.current === 'ai_speaking') {
        setPhaseSync('user_listening')
        startListening()
      }
    }).catch(() => {
      if (isMountedRef.current && phaseRef.current === 'ai_speaking') {
        setPhaseSync('user_listening')
        setNeedsTapToSpeak(true)
      }
    })

    return () => {
      isMountedRef.current = false
      stopMic()
      stopSpeaking()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const showTapToSpeak = (phase === 'awaiting_answer' || needsTapToSpeak) && hasSpeechAPI && phase !== 'ai_speaking'

  return (
    <div className="chat-page">
      <div className="chat-page__inner">
        <header className="chat-page__header">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
            ← Back
          </button>
          <h1 className="chat-page__title">Chat with {mathematician}</h1>
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
                <div className="chat-msg__equation" aria-label="Equation">{msg.equation}</div>
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

        {showTapToSpeak && (
          <button
            type="button"
            className="btn btn--primary chat-page__answer-btn"
            onClick={() => {
              setNeedsTapToSpeak(false)
              startListening()
            }}
          >
            {phase === 'awaiting_answer' ? 'Tap to answer' : 'Tap to speak'}
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
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleGenerateVideo}>
            Generate video explanation
          </button>
          <button type="button" className="btn btn--primary" onClick={handleEndConversation}>
            End conversation
          </button>
        </div>
      </div>
    </div>
  )
}
