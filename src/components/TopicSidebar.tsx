import { useState, useEffect, useMemo } from 'react'
import { getUserMetadata } from '../lib/firebaseMetadata'
import { MATH_TOPICS, DEFAULT_ELO } from '../../shared/metadataSchema'
import type { User } from '../types'

function formatTopic(topic: string): string {
  return topic.replace(/_/g, ' ')
}

interface Props {
  user: User
}

export function TopicSidebar({ user }: Props) {
  const [topicElo, setTopicElo] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

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
          <div className="topic-sidebar__tags">
            {explore.slice(0, 6).map((t) => (
              <span key={t} className="topic-tag topic-tag--explore">
                {formatTopic(t)}
              </span>
            ))}
            {explore.length > 6 && (
              <span className="topic-sidebar__more">+{explore.length - 6} more</span>
            )}
          </div>
        </section>
      )}
    </aside>
  )
}
