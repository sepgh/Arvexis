import { useCallback, useRef, useState } from 'react'

export function usePanelResize(initial: number, min: number, max: number, side: 'left' | 'right' = 'left') {
  const [width, setWidth] = useState(initial)
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current   = e.clientX
    startW.current   = width

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return
      const rawDelta = ev.clientX - startX.current
      // For right-side panels, dragging left (negative) should widen the panel
      const delta = side === 'right' ? -rawDelta : rawDelta
      setWidth(Math.min(max, Math.max(min, startW.current + delta)))
    }

    function onUp() {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [width, min, max, side])

  return { width, onMouseDown }
}
