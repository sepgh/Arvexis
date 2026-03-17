import { useState, useRef } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { FlowNodeData } from '@/hooks/useGraph'

export default function DecisionNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
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
        selected ? 'border-violet-400 shadow-violet-500/20 shadow-xl' : 'border-violet-500/40',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Top} className="!bg-violet-400 !border-card !w-2.5 !h-2.5" />

      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <div className="flex items-center justify-center w-5 h-5 rounded bg-violet-500/15 text-violet-400 shrink-0">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1L10 5.5 5.5 10 1 5.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M5.5 3.5v4M3.5 5.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="text-[10px] font-medium text-violet-400 uppercase tracking-wider">Decision</span>
        {data.isRoot && (
          <span className="ml-auto text-[9px] px-1 py-px rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">
            ROOT
          </span>
        )}
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
            className="w-full bg-transparent text-sm font-medium text-foreground outline-none border-b border-violet-400"
          />
        ) : (
          <span className="text-sm font-medium text-foreground block truncate max-w-[160px]">
            {data.name}
          </span>
        )}
      </div>

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

      <Handle type="source" position={Position.Bottom} className="!bg-violet-400 !border-card !w-2.5 !h-2.5" />
    </div>
  )
}
