import { useEditorStore } from '@/store'
import type { FlowNodeData } from '@/hooks/useGraph'
import SceneEditor from './SceneEditor'
import StateEditor from './StateEditor'
import ConditionEditor from './DecisionEditor'

interface NodeEditorPanelProps {
  nodeData: FlowNodeData
  onConditionsChanged?: () => void
  onNodeUpdated?: () => void
}

const TYPE_LABEL: Record<string, string> = {
  scene:     'Scene',
  state:     'State',
  condition: 'Condition',
}

const TYPE_COLOR: Record<string, string> = {
  scene:     'text-blue-400 border-blue-500/30 bg-blue-500/5',
  state:     'text-amber-400 border-amber-500/30 bg-amber-500/5',
  condition: 'text-violet-400 border-violet-500/30 bg-violet-500/5',
}

export default function NodeEditorPanel({ nodeData, onConditionsChanged, onNodeUpdated }: NodeEditorPanelProps) {
  const setSelectedNodeId = useEditorStore(s => s.setSelectedNodeId)

  return (
    <div className="flex flex-col w-full border-l border-border bg-card overflow-hidden h-full">
      {/* Header */}
      <div className={`flex items-center border-b border-border shrink-0 ${TYPE_COLOR[nodeData.type] ?? ''}`} style={{ padding: '18px 24px', gap: 12 }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wider opacity-70" style={{ fontSize: 12 }}>
              {TYPE_LABEL[nodeData.type] ?? nodeData.type}
            </span>
            {nodeData.isRoot && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">ROOT</span>
            )}
            {nodeData.isEnd && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-medium">END</span>
            )}
          </div>
          <p className="font-medium text-foreground truncate" style={{ fontSize: 18, marginTop: 4 }}>{nodeData.name}</p>
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="text-muted-foreground hover:text-foreground leading-none shrink-0"
          style={{ fontSize: 22, padding: 4 }}
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
            autoContinue={nodeData.autoContinue}
            loopVideo={nodeData.loopVideo}
            backgroundColor={nodeData.backgroundColor ?? null}
            musicAssetId={nodeData.musicAssetId ?? null}
            onNodeUpdated={onNodeUpdated}
          />
        )}
        {nodeData.type === 'state' && (
          <StateEditor nodeId={nodeData.id} />
        )}
        {nodeData.type === 'condition' && (
          <ConditionEditor nodeId={nodeData.id} onConditionsChanged={onConditionsChanged} />
        )}
      </div>
    </div>
  )
}
