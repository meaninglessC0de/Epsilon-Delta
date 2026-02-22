import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserMetadata } from '../lib/firebaseMetadata'
import { getRandomPromptForTopic } from '../lib/topicPrompts'
import { MATH_TOPICS, DEFAULT_ELO } from '../../shared/metadataSchema'
import type { User } from '../types'

function formatTopic(topic: string): string {
  return topic.replace(/_/g, ' ')
}

interface Props {
  user: User
}

export function TopicSidebar({ user }: Props) {
  const navigate = useNavigate()
  const [topicElo, setTopicElo] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const handleExploreTopic = useCallback(
    (topic: string) => {
      const question = getRandomPromptForTopic(topic)
      navigate('/manim', { state: { suggestedQuestion: question, autoGenerate: true } })
    },
    [navigate]
  )

  useEffect(() => {
    getUserMetadata(user.id)
      .then((meta) => {
        if (meta?.topicElo) setTopicElo(meta.topicElo)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user.id])

  const updatedSkills = useMemo(() => {
    return MATH_TOPICS.filter((t) => (topicElo[t] ?? DEFAULT_ELO) !== DEFAULT_ELO)
      .map((topic) => ({ topic, elo: topicElo[topic] ?? DEFAULT_ELO }))
      .sort((a, b) => b.elo - a.elo)
  }, [topicElo])

  const explore = useMemo(() => {
    return MATH_TOPICS.filter((t) => (topicElo[t] ?? DEFAULT_ELO) === DEFAULT_ELO)
      .sort((a, b) => formatTopic(a).localeCompare(formatTopic(b)))
  }, [topicElo])

  const hasAny = updatedSkills.length > 0 || explore.length > 0

  if (loading) return null

  if (!hasAny) return null

  return (
    <aside className="topic-sidebar">
      <h3 className="topic-sidebar__title">Skills</h3>

      {updatedSkills.length > 0 && (
        <section className="topic-sidebar__section">
          <h4 className="topic-sidebar__label topic-sidebar__label--updated">Updated skills</h4>
          <ul className="topic-sidebar__skill-list">
            {updatedSkills.map(({ topic, elo }) => (
              <li key={topic} className="topic-sidebar__skill-row">
                <span className="topic-sidebar__skill-name">{formatTopic(topic)}</span>
                <span className="topic-sidebar__skill-elo">{elo}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {explore.length > 0 && (
        <section className="topic-sidebar__section">
          <h4 className="topic-sidebar__label topic-sidebar__label--explore">Explore</h4>
          <p className="topic-sidebar__explore-hint">Click for a video in this topic</p>
          <div className="topic-sidebar__tags">
            {explore.map((t) => (
              <button
                key={t}
                type="button"
                className="topic-tag topic-tag--explore topic-tag--clickable"
                onClick={() => handleExploreTopic(t)}
              >
                {formatTopic(t)}
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}
