import { AppNavbar } from './AppNavbar'
import { DashboardSidebar } from './DashboardSidebar'
import { TopicSidebar } from './TopicSidebar'
import type { User } from '../types'

interface Props {
  user: User
  onLogout: () => void
  onHome: () => void
  onNewProblem: () => void
  onOpenChat: () => void
  onGenerateVideo: () => void
  onOpenProfile?: () => void
  children: React.ReactNode
}

export function AppShellWithSidebar({
  user,
  onLogout,
  onHome,
  onNewProblem,
  onOpenChat,
  onGenerateVideo,
  onOpenProfile,
  children,
}: Props) {
  return (
    <div className="app-shell-with-sidebar">
      <AppNavbar user={user} onLogout={onLogout} onHome={onHome} />
      <div className="app-shell__body">
        <DashboardSidebar
          user={user}
          onNewProblem={onNewProblem}
          onOpenChat={onOpenChat}
          onGenerateVideo={onGenerateVideo}
          onOpenProfile={onOpenProfile}
        />
        <main className="app-shell__pocket">
          {children}
        </main>
        <TopicSidebar user={user} />
      </div>
    </div>
  )
}
