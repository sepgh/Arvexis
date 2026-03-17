import { useState, useRef } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { FlowNodeData } from '@/hooks/useGraph'

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

  return (
    <div
      className={[
        'min-w-[140px] rounded-xl border-2 bg-card shadow-lg transition-all',
        selected ? 'border-blue-400 shadow-blue-500/20 shadow-xl' : 'border-blue-500/40',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !border-card !w-2.5 !h-2.5" />

      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <div className="flex items-center justify-center w-5 h-5 rounded bg-blue-500/15 text-blue-400 shrink-0">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="1" y="2" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M7 4.5l3-2v6l-3-2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-[10px] font-medium text-blue-400 uppercase tracking-wider">Scene</span>
        <div className="ml-auto flex items-center gap-1">
          {data.isRoot && (
            <span className="text-[9px] px-1 py-px rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">
              ROOT
            </span>
          )}
          {data.isEnd && (
            <span className="text-[9px] px-1 py-px rounded bg-red-500/15 text-red-400 border border-red-500/20 font-medium">
              END
            </span>
          )}
        </div>
      </div>

      {/* Name */}
      <div className="px-3 pb-2.5" onDoubleClick={startEdit}>
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm font-medium text-foreground outline-none border-b border-blue-400"
          />
        ) : (
          <span className="text-sm font-medium text-foreground block truncate max-w-[160px]">
            {data.name}
          </span>
        )}
      </div>

      {/* Set root context hint */}
      {!data.isRoot && selected && (
        <div className="px-3 pb-2 -mt-1">
          <button
            onClick={() => data.onSetRoot(data.id)}
            className="text-[10px] text-muted-foreground hover:text-amber-400 transition-colors"
          >
            Set as root
          </button>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !border-card !w-2.5 !h-2.5" />
    </div>
  )
}
