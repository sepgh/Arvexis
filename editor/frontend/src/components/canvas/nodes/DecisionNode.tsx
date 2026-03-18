import { useState, useRef } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { FlowNodeData } from '@/hooks/useGraph'
import type { NodeExit } from '@/types'

export default function ConditionNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.name)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(data.name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commitEdit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== data.name) {
      await data.onRename(data.id, trimmed)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') { setEditing(false); setDraft(data.name) }
    e.stopPropagation()
  }

  const exits: NodeExit[] = data.exits ?? []

  return (
    <div
      className={[
        'min-w-[220px] rounded-xl border-2 bg-card shadow-lg transition-all',
        selected ? 'border-violet-400 shadow-violet-500/20 shadow-xl' : 'border-violet-500/40',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Top} className="!bg-violet-400 !border-card !w-3 !h-3" />

      {/* Header */}
      <div className="flex items-center" style={{ padding: '16px 16px 6px 16px', gap: 8 }}>
        <div className="flex items-center justify-center w-6 h-6 rounded bg-violet-500/15 text-violet-400 shrink-0">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1L10 5.5 5.5 10 1 5.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M3.5 5.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="font-medium text-violet-400 uppercase tracking-wider" style={{ fontSize: 12 }}>Condition</span>
        {data.isRoot && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">
            ROOT
          </span>
        )}
      </div>

      {/* Name */}
      <div style={{ padding: '0 16px 12px 16px' }} onClick={startEdit} title="Click to rename">
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm font-semibold text-foreground outline-none border-b border-violet-400"
          />
        ) : (
          <span className="font-semibold text-foreground block truncate max-w-[200px] cursor-text hover:text-violet-300 transition-colors" style={{ fontSize: 16 }}>
            {data.name}
          </span>
        )}
      </div>

      {!data.isRoot && selected && (
        <div className="px-4 pb-2 -mt-1">
          <button
            onClick={() => data.onSetRoot(data.id)}
            className="text-[10px] text-muted-foreground hover:text-amber-400 transition-colors"
          >
            Set as root
          </button>
        </div>
      )}

      {/* Per-condition exit handles */}
      {exits.length > 0 && (
        <div className="border-t border-violet-500/20 flex flex-col" style={{ padding: '8px 16px', gap: 6 }}>
          {exits.map((exit) => (
            <div key={exit.key} className="relative flex items-center justify-between text-xs">
              <span className={[
                'truncate max-w-[120px]',
                exit.isDefault ? 'text-violet-300 font-medium italic' : 'text-muted-foreground',
              ].join(' ')}>
                {exit.label}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={exit.key}
                style={{ top: 'auto', right: -10, position: 'relative', transform: 'none' }}
                className="!bg-violet-400 !border-card !w-3 !h-3 !relative !static !transform-none !mx-1"
              />
            </div>
          ))}
        </div>
      )}

      {exits.length === 0 && (
        <div className="border-t border-violet-500/20" style={{ padding: '8px 16px' }}>
          <span className="text-xs text-muted-foreground italic">No conditions — add in editor</span>
        </div>
      )}
    </div>
  )
}
