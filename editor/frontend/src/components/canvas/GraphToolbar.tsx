import type { NodeType } from '@/types'

interface GraphToolbarProps {
  onAddNode: (type: NodeType) => void
}

const NODES: { type: NodeType; label: string; color: string; icon: React.ReactNode }[] = [
  {
    type: 'scene',
    label: 'Scene',
    color: 'text-blue-400 border-blue-500/40 hover:border-blue-400 hover:bg-blue-500/10',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="1" y="2.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M9 5.5l3.5-2.5v7L9 7.5v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    type: 'state',
    label: 'State',
    color: 'text-amber-400 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/10',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M2 3.5h3M2 6.5h6M2 9.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M9 1.5l2.5 2.5-2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    type: 'condition',
    label: 'Condition',
    color: 'text-violet-400 border-violet-500/40 hover:border-violet-400 hover:bg-violet-500/10',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M6.5 1L12 6.5 6.5 12 1 6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        <path d="M4 6.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function GraphToolbar({ onAddNode }: GraphToolbarProps) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center bg-card/90 backdrop-blur border border-border rounded-xl shadow-xl" style={{ padding: '10px 16px', gap: 10 }}>
      <span className="text-muted-foreground select-none font-medium" style={{ fontSize: 14, paddingRight: 4 }}>Add</span>
      {NODES.map(({ type, label, color, icon }) => (
        <button
          key={type}
          onClick={() => onAddNode(type)}
          className={[
            'flex items-center rounded-lg font-medium border transition-all',
            color,
          ].join(' ')}
          style={{ padding: '10px 16px', fontSize: 14, gap: 8 }}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  )
}
