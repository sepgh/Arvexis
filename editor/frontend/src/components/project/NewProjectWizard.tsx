import { useState } from 'react'
import { createProject } from '@/api/project'
import { useEditorStore } from '@/store'

interface NewProjectWizardProps {
  onClose: () => void
}

const FPS_OPTIONS = [24, 30, 60]
const RESOLUTION_OPTIONS = ['1280x720', '1920x1080', '2560x1440', '3840x2160']
const SAMPLE_RATE_OPTIONS = [44100, 48000]

export default function NewProjectWizard({ onClose }: NewProjectWizardProps) {
  const setProjectConfig = useEditorStore((s) => s.setProjectConfig)

  const [name, setName] = useState('')
  const [dirPath, setDirPath] = useState('')
  const [fps, setFps] = useState(30)
  const [previewRes, setPreviewRes] = useState('1280x720')
  const [sampleRate, setSampleRate] = useState(44100)
  const [decisionTimeout, setDecisionTimeout] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !dirPath.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const config = await createProject({
        name: name.trim(),
        directoryPath: dirPath.trim(),
        fps,
        previewResolution: previewRes,
        audioSampleRate: sampleRate,
        decisionTimeoutSecs: decisionTimeout,
      })
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
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">New Project</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
          <Field label="Project Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Interactive Story"
              required
              className="input-base"
            />
          </Field>

          <Field label="Directory Path" required hint="The project folder will be created here">
            <input
              type="text"
              value={dirPath}
              onChange={(e) => setDirPath(e.target.value)}
              placeholder="/home/user/projects/my-story"
              required
              className="input-base font-mono text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Frame Rate">
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="input-base"
              >
                {FPS_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f} fps</option>
                ))}
              </select>
            </Field>

            <Field label="Preview Resolution">
              <select
                value={previewRes}
                onChange={(e) => setPreviewRes(e.target.value)}
                className="input-base"
              >
                {RESOLUTION_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Audio Sample Rate">
              <select
                value={sampleRate}
                onChange={(e) => setSampleRate(Number(e.target.value))}
                className="input-base"
              >
                {SAMPLE_RATE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r} Hz</option>
                ))}
              </select>
            </Field>

            <Field label="Decision Timeout (s)">
              <input
                type="number"
                value={decisionTimeout}
                onChange={(e) => setDecisionTimeout(Number(e.target.value))}
                min={1}
                max={60}
                step={0.5}
                className="input-base"
              />
            </Field>
          </div>

          {error && (
            <div className="text-sm text-destructive-foreground bg-destructive rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !dirPath.trim()}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-primary ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

