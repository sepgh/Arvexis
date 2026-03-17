import { useEffect, useState } from 'react'
import { usePreview } from '@/hooks/usePreview'
import { cancelPreview, type PreviewJobStatus } from '@/api/preview'

interface PreviewModalProps {
  initialJob: PreviewJobStatus
  title: string
  onClose: () => void
}

export default function PreviewModal({ initialJob, title, onClose }: PreviewModalProps) {
  const { job, polling } = usePreview(initialJob)
  const [cancelling, setCancelling] = useState(false)

  // Close on Escape (only when not running)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && job?.status !== 'running' && job?.status !== 'pending') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, job?.status])

  const isActive    = job?.status === 'running' || job?.status === 'pending' || polling
  const isDone      = job?.status === 'done'
  const isFailed    = job?.status === 'failed'
  const isCancelled = job?.status === 'cancelled'
  const progress    = job?.progress ?? 0
  const statusText  = job?.statusText ?? (isActive ? 'Compiling…' : '')

  async function handleCancel() {
    if (!job || cancelling) return
    setCancelling(true)
    try { await cancelPreview(job.jobId) } catch { /* best-effort */ }
    setCancelling(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget && !isActive) onClose()
      }}
    >
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
            <p className="text-sm font-medium text-foreground">{title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isActive}
            className="text-muted-foreground hover:text-foreground text-xl leading-none ml-4 disabled:opacity-30"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5">

          {/* ── Active: progress bar + status text + cancel ── */}
          {isActive && (
            <div className="flex flex-col gap-4 py-6">
              {/* Status text */}
              <p className="text-sm text-center text-muted-foreground">{statusText}</p>

              {/* Progress bar */}
              <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Percentage + cancel */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="text-xs px-3 py-1 rounded-md border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
            </div>
          )}

          {/* ── Failed ── */}
          {isFailed && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center text-xl">⚠</div>
              <p className="text-sm font-medium text-red-400">Compilation failed</p>
              <pre className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-4 py-3 max-h-36 overflow-y-auto w-full whitespace-pre-wrap break-all">
                {job?.error || 'Unknown error'}
              </pre>
              <button
                onClick={onClose}
                className="mt-1 text-xs px-4 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* ── Cancelled ── */}
          {isCancelled && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-muted-foreground">Preview cancelled.</p>
              <button
                onClick={onClose}
                className="text-xs px-4 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* ── Done: video player ── */}
          {isDone && job?.fileUrl && (
            <video
              key={job.fileUrl}
              src={job.fileUrl}
              controls
              autoPlay
              className="w-full rounded-lg bg-black"
              style={{ maxHeight: '65vh' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
