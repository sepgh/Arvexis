import { useState } from 'react'
import { openProject } from '@/api/project'
import { useEditorStore } from '@/store'

interface OpenProjectDialogProps {
  onClose: () => void
}

export default function OpenProjectDialog({ onClose }: OpenProjectDialogProps) {
  const setProjectConfig = useEditorStore((s) => s.setProjectConfig)

  const [dirPath, setDirPath] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dirPath.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const config = await openProject(dirPath.trim())
      setProjectConfig(config)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border" style={{ padding: '20px 28px' }}>
          <h2 className="font-semibold text-foreground" style={{ fontSize: 20 }}>Open Project</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-2xl leading-none p-1"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-7 py-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Project Directory <span className="text-primary">*</span>
            </label>
            <input
              type="text"
              value={dirPath}
              onChange={(e) => setDirPath(e.target.value)}
              placeholder="/home/user/projects/my-story"
              required
              autoFocus
              className="input-base font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Path to an existing project folder containing <code className="text-foreground">project.db</code> and <code className="text-foreground">assets/</code>
            </p>
          </div>

          {error && (
            <div className="text-sm text-destructive-foreground bg-destructive rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !dirPath.trim()}
              className="font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              style={{ padding: '10px 24px', fontSize: 14 }}
            >
              {submitting ? 'Opening…' : 'Open Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
