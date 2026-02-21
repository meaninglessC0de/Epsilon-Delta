import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { User } from '../../types'
import type { UserMetadata } from '../../shared/types'
import { getUserMetadata } from '../../lib/firebaseMetadata'
import { updateMetadata } from '../../lib/auth'
import { OnboardingLayout } from './OnboardingLayout'
import { WelcomeStep } from './steps/WelcomeStep'
import { BasicsStep } from './steps/BasicsStep'
import { LearningStyleStep } from './steps/LearningStyleStep'
import { PreferenceScoresStep } from './steps/PreferenceScoresStep'
import { PreferencesStep } from './steps/PreferencesStep'

const TOTAL_STEPS = 5

interface OnboardingFlowProps {
  user: User
  onComplete: () => void
}

export function OnboardingFlow({ user, onComplete }: OnboardingFlowProps) {
  const { stepIndex: stepIndexParam } = useParams()
  const navigate = useNavigate()
  const stepFromUrl = stepIndexParam != null ? Math.min(TOTAL_STEPS - 1, Math.max(0, parseInt(stepIndexParam, 10) || 0)) : null
  const [step, setStep] = useState(stepFromUrl ?? 0)
  const [meta, setMeta] = useState<UserMetadata | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (stepFromUrl !== null) setStep(stepFromUrl)
  }, [stepFromUrl])

  // Step-local form state (so we can pass to child and merge on Next)
  const [basics, setBasics] = useState<Pick<UserMetadata, 'university' | 'studyLevel' | 'courses' | 'mathTopics'>>({
    university: undefined,
    studyLevel: undefined,
    courses: [],
    mathTopics: [],
  })
  const [learningStyle, setLearningStyle] = useState<Pick<UserMetadata, 'learningStyle' | 'tonePreference' | 'environmentPreference' | 'contentEngagement'>>({})
  const [preferenceScores, setPreferenceScores] = useState<UserMetadata['preferenceScores']>(undefined)
  const [prefs, setPrefs] = useState<Pick<UserMetadata, 'learningPrefs' | 'learningDisabilities' | 'procrastinationLevel' | 'otherNeeds'>>({
    learningPrefs: {},
    learningDisabilities: [],
  })

  useEffect(() => {
    let cancelled = false
    getUserMetadata(user.id)
      .then((m) => {
        if (!cancelled && m) {
          setMeta(m)
          const savedStep = m.onboardingStep ?? 0
          const effectiveStep = stepFromUrl ?? savedStep
          const clamped = Math.min(TOTAL_STEPS - 1, Math.max(0, effectiveStep))
          setStep(clamped)
          if (stepFromUrl === null) navigate(`/onboarding/${clamped}`, { replace: true })
          setBasics({
            university: m.university,
            studyLevel: m.studyLevel,
            courses: m.courses ?? [],
            mathTopics: m.mathTopics ?? [],
          })
          setLearningStyle({
            learningStyle: m.learningStyle,
            tonePreference: m.tonePreference,
            environmentPreference: m.environmentPreference,
            contentEngagement: m.contentEngagement,
          })
          setPreferenceScores(m.preferenceScores)
          setPrefs({
            learningPrefs: m.learningPrefs ?? {},
            learningDisabilities: m.learningDisabilities ?? [],
            procrastinationLevel: m.procrastinationLevel,
            otherNeeds: m.otherNeeds,
          })
        }
      })
    return () => { cancelled = true }
  }, [user.id, stepFromUrl, navigate])

  const saveAndNext = useCallback(async () => {
    setSaving(true)
    try {
      if (step === 0) {
        await updateMetadata({ onboardingStep: 1 })
        setStep(1)
        navigate('/onboarding/1', { replace: true })
      } else if (step === 1) {
        await updateMetadata({
          ...basics,
          onboardingStep: 2,
        })
        setStep(2)
        navigate('/onboarding/2', { replace: true })
      } else if (step === 2) {
        await updateMetadata({
          ...learningStyle,
          onboardingStep: 3,
        })
        setStep(3)
        navigate('/onboarding/3', { replace: true })
      } else if (step === 3) {
        await updateMetadata({
          preferenceScores,
          onboardingStep: 4,
        })
        setStep(4)
        navigate('/onboarding/4', { replace: true })
      } else if (step === 4) {
        await updateMetadata({
          ...prefs,
          onboardingStep: TOTAL_STEPS,
          onboardingComplete: true,
        })
        onComplete()
      }
    } finally {
      setSaving(false)
    }
  }, [step, basics, learningStyle, preferenceScores, prefs, onComplete, navigate])

  const back = useCallback(() => {
    if (step > 0) {
      const next = step - 1
      setStep(next)
      navigate(`/onboarding/${next}`, { replace: true })
    }
  }, [step, navigate])

  // Always show onboarding UI (no full-screen loading). Step 0 + empty forms until meta loads.
  const stepTitles = [
    { title: 'Welcome', subtitle: 'A quick setup so we can personalise your experience.' },
    { title: 'Basics', subtitle: 'Tell us about your course and the topics you want to focus on.' },
    { title: 'Learning style', subtitle: 'How you learn and what kind of feedback you like.' },
    { title: 'Quick picks', subtitle: 'A few would-you-rather and ratings so we can tailor your experience.' },
    { title: 'Preferences & accessibility', subtitle: 'Anything that helps us tailor content to you.' },
  ]

  const current = stepTitles[step] ?? stepTitles[0]

  const isStepValid =
    step === 0 ||
    (step === 1 &&
      !!basics.university?.trim() &&
      !!basics.studyLevel &&
      Array.isArray(basics.mathTopics) &&
      basics.mathTopics.length >= 1) ||
    (step === 2 &&
      !!learningStyle.learningStyle &&
      !!learningStyle.tonePreference &&
      !!learningStyle.environmentPreference &&
      !!learningStyle.contentEngagement) ||
    step === 3 ||
    (step === 4 && typeof prefs.procrastinationLevel === 'number' && prefs.procrastinationLevel >= 1 && prefs.procrastinationLevel <= 5)

  return (
    <OnboardingLayout
      step={step}
      title={current.title}
      subtitle={current.subtitle}
      onNext={saveAndNext}
      onBack={step > 0 ? back : undefined}
      nextLabel={step === 4 ? 'Finish' : 'Continue'}
      loading={saving}
      nextDisabled={!isStepValid}
      validationHint={!isStepValid && step >= 1 ? 'Please complete all required fields.' : undefined}
    >
      {step === 0 && <WelcomeStep />}
      {step === 1 && <BasicsStep initial={basics} onChange={setBasics} />}
      {step === 2 && <LearningStyleStep initial={learningStyle} onChange={setLearningStyle} />}
      {step === 3 && <PreferenceScoresStep initial={preferenceScores} onChange={setPreferenceScores} />}
      {step === 4 && <PreferencesStep initial={prefs} onChange={setPrefs} />}
    </OnboardingLayout>
  )
}
