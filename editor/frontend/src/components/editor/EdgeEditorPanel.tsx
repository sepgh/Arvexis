import { useEditorStore } from '@/store'
import TransitionEditor from './TransitionEditor'

interface EdgeEditorPanelProps {
  edgeId: string
}

export default function EdgeEditorPanel({ edgeId }: EdgeEditorPanelProps) {
  const setSelectedEdgeId = useEditorStore(s => s.setSelectedEdgeId)

  return (
    <div className="flex flex-col w-80 shrink-0 border-l border-border bg-card overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0 text-slate-400 border-slate-500/30 bg-slate-500/5">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Edge</span>
          <p className="text-sm font-medium text-foreground mt-0.5">Transition</p>
        </div>
        <button
          onClick={() => setSelectedEdgeId(null)}
          className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <TransitionEditor edgeId={edgeId} />
      </div>
    </div>
  )
}
