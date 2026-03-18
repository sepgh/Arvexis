import { useState } from 'react'
import NewProjectWizard from '@/components/project/NewProjectWizard'
import OpenProjectDialog from '@/components/project/OpenProjectDialog'

type Dialog = 'new' | 'open' | null

export default function WelcomePage() {
  const [dialog, setDialog] = useState<Dialog>(null)

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-background select-none">
      {/* Logo / title area */}
      <div className="flex flex-col items-center gap-3 mb-12">
        <div className="rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center" style={{ width: 88, height: 88 }}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="2" y="6" width="20" height="14" rx="2" fill="currentColor" className="text-primary" opacity="0.8" />
            <polygon points="24,8 30,13 24,18" fill="currentColor" className="text-primary" />
            <circle cx="8" cy="24" r="2.5" fill="currentColor" className="text-muted-foreground" />
            <circle cx="16" cy="24" r="2.5" fill="currentColor" className="text-muted-foreground" />
            <circle cx="24" cy="24" r="2.5" fill="currentColor" className="text-muted-foreground" />
            <line x1="10.5" y1="24" x2="13.5" y2="24" stroke="currentColor" className="text-muted-foreground" strokeWidth="1.5" />
            <line x1="18.5" y1="24" x2="21.5" y2="24" stroke="currentColor" className="text-muted-foreground" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="font-semibold text-foreground tracking-tight" style={{ fontSize: 32 }}>
            Arvexis
          </h1>
          <p className="text-muted-foreground" style={{ fontSize: 16, marginTop: 8 }}>
            Node-based editor for interactive video experiences
          </p>
        </div>
      </div>

      {/* Action cards */}
      <div className="flex gap-6">
        <ActionCard
          title="New Project"
          description="Start from scratch with a new project directory"
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <line x1="10" y1="7" x2="10" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          onClick={() => setDialog('new')}
          primary
        />
        <ActionCard
          title="Open Project"
          description="Load an existing project from a directory"
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 7h14M3 7v9a1 1 0 001 1h12a1 1 0 001-1V7M3 7V5a1 1 0 011-1h3l2 2h6a1 1 0 011 1v0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          onClick={() => setDialog('open')}
        />
      </div>

      {/* Modals */}
      {dialog === 'new' && (
        <NewProjectWizard onClose={() => setDialog(null)} />
      )}
      {dialog === 'open' && (
        <OpenProjectDialog onClose={() => setDialog(null)} />
      )}
    </div>
  )
}

interface ActionCardProps {
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
  primary?: boolean
}

function ActionCard({ title, description, icon, onClick, primary }: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex flex-col items-start rounded-xl border text-left transition-all',
        'hover:scale-[1.02] active:scale-[0.98]',
        primary
          ? 'bg-primary/10 border-primary/30 hover:bg-primary/15 hover:border-primary/50'
          : 'bg-card border-border hover:bg-accent hover:border-border',
      ].join(' ')}
      style={{ width: 280, padding: 32, gap: 20 }}
    >
      <div
        className={[
          'rounded-lg flex items-center justify-center w-12 h-12',
          primary ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
        ].join(' ')}
      >
        {icon}
      </div>
      <div>
        <p className="font-medium text-foreground" style={{ fontSize: 18 }}>{title}</p>
        <p className="text-muted-foreground leading-relaxed" style={{ fontSize: 15, marginTop: 6 }}>{description}</p>
      </div>
    </button>
  )
}
