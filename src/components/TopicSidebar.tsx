import { useState, useEffect } from 'react'
import { getUserMetadata } from '../lib/firebaseMetadata'
import { MATH_TOPICS, DEFAULT_ELO } from '../../shared/metadataSchema'
import type { User } from '../types'

const STRONG_THRESHOLD = 1600
const NEED_HELP_THRESHOLD = 1400

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

  const strong: string[] = []
  const needHelp: string[] = []
  const explore: string[] = []

  for (const topic of MATH_TOPICS) {
    const elo = topicElo[topic] ?? DEFAULT_ELO
    if (elo >= STRONG_THRESHOLD) strong.push(topic)
    else if (elo <= NEED_HELP_THRESHOLD) needHelp.push(topic)
    else if (elo === DEFAULT_ELO) explore.push(topic)
  }

  // Sort strong by elo desc, needHelp by elo asc, explore alphabetically
  strong.sort((a, b) => (topicElo[b] ?? 0) - (topicElo[a] ?? 0))
  needHelp.sort((a, b) => (topicElo[a] ?? 0) - (topicElo[b] ?? 0))
  explore.sort((a, b) => formatTopic(a).localeCompare(formatTopic(b)))

  const hasAny = strong.length > 0 || needHelp.length > 0 || explore.length > 0

  if (loading) return null

  if (!hasAny) return null

  return (
    <aside className="topic-sidebar">
      <h3 className="topic-sidebar__title">Topics</h3>

      {strong.length > 0 && (
        <section className="topic-sidebar__section">
          <h4 className="topic-sidebar__label topic-sidebar__label--strong">Strong</h4>
          <div className="topic-sidebar__tags">
            {strong.map((t) => (
              <span key={t} className="topic-tag topic-tag--strong">
                {formatTopic(t)}
              </span>
            ))}
          </div>
        </section>
      )}

      {needHelp.length > 0 && (
        <section className="topic-sidebar__section">
          <h4 className="topic-sidebar__label topic-sidebar__label--help">Need help</h4>
          <div className="topic-sidebar__tags">
            {needHelp.map((t) => (
              <span key={t} className="topic-tag topic-tag--help">
                {formatTopic(t)}
              </span>
            ))}
          </div>
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
