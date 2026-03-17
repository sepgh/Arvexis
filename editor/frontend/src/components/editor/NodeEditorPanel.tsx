import { useEditorStore } from '@/store'
import type { FlowNodeData } from '@/hooks/useGraph'
import SceneEditor from './SceneEditor'
import StateEditor from './StateEditor'
import DecisionEditor from './DecisionEditor'

interface NodeEditorPanelProps {
  nodeData: FlowNodeData
}

const TYPE_LABEL: Record<string, string> = {
  scene: 'Scene',
  state: 'State',
  decision: 'Decision',
}

const TYPE_COLOR: Record<string, string> = {
  scene:    'text-blue-400 border-blue-500/30 bg-blue-500/5',
  state:    'text-amber-400 border-amber-500/30 bg-amber-500/5',
  decision: 'text-violet-400 border-violet-500/30 bg-violet-500/5',
}

export default function NodeEditorPanel({ nodeData }: NodeEditorPanelProps) {
  const setSelectedNodeId = useEditorStore(s => s.setSelectedNodeId)

  return (
    <div className="flex flex-col w-80 shrink-0 border-l border-border bg-card overflow-hidden h-full">
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-3 border-b border-border shrink-0 ${TYPE_COLOR[nodeData.type] ?? ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
              {TYPE_LABEL[nodeData.type] ?? nodeData.type}
            </span>
            {nodeData.isRoot && (
              <span className="text-[9px] px-1 py-px rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">ROOT</span>
            )}
            {nodeData.isEnd && (
              <span className="text-[9px] px-1 py-px rounded bg-red-500/15 text-red-400 border border-red-500/20 font-medium">END</span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground truncate mt-0.5">{nodeData.name}</p>
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-hidden">
        {nodeData.type === 'scene' && (
          <SceneEditor
            nodeId={nodeData.id}
            isEnd={nodeData.isEnd}
            backgroundColor={nodeData.backgroundColor ?? null}
          />
        )}
        {nodeData.type === 'state' && (
          <StateEditor nodeId={nodeData.id} />
        )}
        {nodeData.type === 'decision' && (
          <DecisionEditor nodeId={nodeData.id} />
        )}
      </div>
    </div>
  )
}
