import type { ReactNode } from 'react'
import { usePanelResize } from '@/hooks/usePanelResize'

interface ResizableSidePanelProps {
  side: 'left' | 'right'
  initialWidth?: number
  minWidth?: number
  maxWidth?: number
  children: ReactNode
}

export default function ResizableSidePanel({
  side,
  initialWidth = 288,
  minWidth = 200,
  maxWidth = 600,
  children,
}: ResizableSidePanelProps) {
  const { width, onMouseDown } = usePanelResize(initialWidth, minWidth, maxWidth, side)

  const handleClass = [
    'absolute top-0 bottom-0 z-10 w-1.5 cursor-col-resize',
    'hover:bg-primary/30 active:bg-primary/50 transition-colors',
    side === 'left' ? 'right-0' : 'left-0',
  ].join(' ')

  return (
    <div
      className="relative shrink-0 h-full overflow-hidden flex flex-col"
      style={{ width }}
    >
      {children}
      <div className={handleClass} onMouseDown={onMouseDown} />
    </div>
  )
}
