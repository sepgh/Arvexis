import { useState, useRef } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { FlowNodeData } from '@/hooks/useGraph'
import type { NodeExit } from '@/types'

export default function SceneNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
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

  const exits: NodeExit[] = data.exits ?? [{ key: 'CONTINUE', label: 'Continue', isDefault: true }]

  return (
    <div
      className={[
        'min-w-[220px] rounded-xl border-2 bg-card shadow-lg transition-all',
        selected ? 'border-blue-400 shadow-blue-500/20 shadow-xl' : 'border-blue-500/40',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !border-card !w-3 !h-3" />

      {/* Header */}
      <div className="flex items-center" style={{ padding: '16px 16px 6px 16px', gap: 8 }}>
        <div className="flex items-center justify-center w-6 h-6 rounded bg-blue-500/15 text-blue-400 shrink-0">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="1" y="2" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M7 4.5l3-2v6l-3-2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="font-medium text-blue-400 uppercase tracking-wider" style={{ fontSize: 12 }}>Scene</span>
        <div className="ml-auto flex items-center gap-1">
          {data.isRoot && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">
              ROOT
            </span>
          )}
          {data.isEnd && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-medium">
              END
            </span>
          )}
        </div>
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
            className="w-full bg-transparent text-sm font-semibold text-foreground outline-none border-b border-blue-400"
          />
        ) : (
          <span className="font-semibold text-foreground block truncate max-w-[200px] cursor-text hover:text-blue-300 transition-colors" style={{ fontSize: 16 }}>
            {data.name}
          </span>
        )}
      </div>

      {/* Set root context hint */}
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

      {/* Per-decision exit handles */}
      <div className="border-t border-blue-500/20 flex flex-col" style={{ padding: '8px 16px', gap: 6 }}>
        {exits.map((exit) => (
          <div key={exit.key} className="relative flex items-center justify-between text-xs">
            <span className={[
              'truncate max-w-[120px]',
              exit.isDefault ? 'text-amber-400 font-medium' : 'text-muted-foreground',
            ].join(' ')}>
              {exit.label}
              {exit.isDefault && exits.length > 1 && (
                <span className="ml-1 text-amber-400/60">(default)</span>
              )}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id={exit.key}
              style={{ top: 'auto', right: -10, position: 'relative', transform: 'none' }}
              className="!bg-blue-400 !border-card !w-3 !h-3 !relative !static !transform-none !mx-1"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
