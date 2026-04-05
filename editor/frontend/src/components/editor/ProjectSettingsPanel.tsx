import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { updateProjectConfig } from '@/api/project'
import { useEditorStore } from '@/store'
import type { ProjectConfig } from '@/types'

interface ProjectSettingsForm {
  name: string
  assetsDirectory: string
  outputDirectory: string
  previewResolution: string
  compileResolutions: string
  fps: string
  audioSampleRate: string
  audioBitRate: string
  decisionTimeoutSecs: string
  defaultLocaleCode: string
  defaultBackgroundColor: string
  hideDecisionButtons: boolean
  showDecisionInputIndicator: boolean
  ffmpegThreads: string
}

function toForm(config: ProjectConfig): ProjectSettingsForm {
  return {
    name: config.name ?? '',
    assetsDirectory: config.assetsDirectory ?? '',
    outputDirectory: config.outputDirectory ?? '',
    previewResolution: config.previewResolution ?? '',
    compileResolutions: (config.compileResolutions ?? []).join(', '),
    fps: String(config.fps ?? 30),
    audioSampleRate: String(config.audioSampleRate ?? 44100),
    audioBitRate: String(config.audioBitRate ?? 128),
    decisionTimeoutSecs: String(config.decisionTimeoutSecs ?? 5),
    defaultLocaleCode: config.defaultLocaleCode ?? '',
    defaultBackgroundColor: config.defaultBackgroundColor ?? '#000000',
    hideDecisionButtons: config.hideDecisionButtons ?? false,
    showDecisionInputIndicator: config.showDecisionInputIndicator ?? false,
    ffmpegThreads: config.ffmpegThreads == null ? '' : String(config.ffmpegThreads),
  }
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeHexColor(value: string): string {
  return value.trim()
}

export default function ProjectSettingsPanel() {
  const projectConfig = useEditorStore((s) => s.projectConfig)
  const setProjectConfig = useEditorStore((s) => s.setProjectConfig)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectSettingsForm | null>(() =>
    projectConfig ? toForm(projectConfig) : null
  )

  useEffect(() => {
    setForm(projectConfig ? toForm(projectConfig) : null)
  }, [projectConfig])

  if (!projectConfig || !form) {
    return null
  }

  const currentForm = form

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!currentForm.name.trim()) return

    const ffmpegThreadsTrimmed = currentForm.ffmpegThreads.trim()
    if (ffmpegThreadsTrimmed !== '') {
      const parsedThreads = Number(ffmpegThreadsTrimmed)
      if (!Number.isInteger(parsedThreads) || parsedThreads < 1) {
        const message = 'FFmpeg threads must be a positive whole number or left blank for Auto'
        setError(message)
        setSaveStatus('error', message)
        return
      }
    }

    const defaultBackgroundColor = normalizeHexColor(currentForm.defaultBackgroundColor)
    if (!/^#[0-9a-fA-F]{6}$/.test(defaultBackgroundColor)) {
      const message = 'Default background color must be a hex color like #000000'
      setError(message)
      setSaveStatus('error', message)
      return
    }

    setSaving(true)
    setError(null)
    setSaveStatus('saving')

    try {
      const ffmpegThreadsAuto = ffmpegThreadsTrimmed === ''
      const updated = await updateProjectConfig({
        name: currentForm.name.trim(),
        assetsDirectory: currentForm.assetsDirectory.trim() || undefined,
        outputDirectory: currentForm.outputDirectory.trim() || undefined,
        previewResolution: currentForm.previewResolution.trim() || undefined,
        compileResolutions: parseList(currentForm.compileResolutions),
        fps: Number(currentForm.fps),
        audioSampleRate: Number(currentForm.audioSampleRate),
        audioBitRate: Number(currentForm.audioBitRate),
        decisionTimeoutSecs: Number(currentForm.decisionTimeoutSecs),
        defaultLocaleCode: currentForm.defaultLocaleCode.trim() || undefined,
        defaultBackgroundColor,
        hideDecisionButtons: currentForm.hideDecisionButtons,
        showDecisionInputIndicator: currentForm.hideDecisionButtons && currentForm.showDecisionInputIndicator,
        ffmpegThreadsAuto,
        ffmpegThreads: ffmpegThreadsAuto ? undefined : Number(ffmpegThreadsTrimmed),
      })
      setProjectConfig(updated)
      setSaveStatus('saved')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save project settings'
      setError(message)
      setSaveStatus('error', message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col w-full border-l border-border bg-card overflow-hidden h-full">
      <div className="flex items-center justify-between border-b border-border shrink-0" style={{ padding: '18px 24px' }}>
        <div>
          <h2 className="font-semibold text-foreground" style={{ fontSize: 18 }}>Project Settings</h2>
          <p className="text-xs text-muted-foreground" style={{ marginTop: 4 }}>Editable project defaults and compilation settings</p>
        </div>
      </div>

      <form className="flex-1 overflow-y-auto" onSubmit={handleSubmit} style={{ padding: 20 }}>
        <div className="flex flex-col gap-4">
          <Field label="Project Name" required>
            <input
              type="text"
              value={currentForm.name}
              onChange={(e) => setForm((prev) => prev ? { ...prev, name: e.target.value } : prev)}
              className="input-base"
            />
          </Field>

          <Field label="Assets Directory" hint="Changing this updates the stored project path only">
            <input
              type="text"
              value={currentForm.assetsDirectory}
              onChange={(e) => setForm((prev) => prev ? { ...prev, assetsDirectory: e.target.value } : prev)}
              className="input-base font-mono text-sm"
            />
          </Field>

          <Field label="Output Directory">
            <input
              type="text"
              value={currentForm.outputDirectory}
              onChange={(e) => setForm((prev) => prev ? { ...prev, outputDirectory: e.target.value } : prev)}
              className="input-base font-mono text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Preview Resolution">
              <input
                type="text"
                value={currentForm.previewResolution}
                onChange={(e) => setForm((prev) => prev ? { ...prev, previewResolution: e.target.value } : prev)}
                className="input-base"
                placeholder="1280x720"
              />
            </Field>

            <Field label="Frame Rate">
              <input
                type="number"
                min={1}
                step={1}
                value={currentForm.fps}
                onChange={(e) => setForm((prev) => prev ? { ...prev, fps: e.target.value } : prev)}
                className="input-base"
              />
            </Field>
          </div>

          <Field label="Compile Resolutions" hint="Comma-separated list, e.g. 2K, 1080p, 720p">
            <input
              type="text"
              value={currentForm.compileResolutions}
              onChange={(e) => setForm((prev) => prev ? { ...prev, compileResolutions: e.target.value } : prev)}
              className="input-base"
              placeholder="2K, 1080p, 720p"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Audio Sample Rate">
              <input
                type="number"
                min={1}
                step={1}
                value={currentForm.audioSampleRate}
                onChange={(e) => setForm((prev) => prev ? { ...prev, audioSampleRate: e.target.value } : prev)}
                className="input-base"
              />
            </Field>

            <Field label="Audio Bit Rate">
              <input
                type="number"
                min={32}
                step={1}
                value={currentForm.audioBitRate}
                onChange={(e) => setForm((prev) => prev ? { ...prev, audioBitRate: e.target.value } : prev)}
                className="input-base"
              />
            </Field>
          </div>

          <Field label="Decision Timeout (s)">
            <input
              type="number"
              min={1}
              max={60}
              step={0.5}
              value={currentForm.decisionTimeoutSecs}
              onChange={(e) => setForm((prev) => prev ? { ...prev, decisionTimeoutSecs: e.target.value } : prev)}
              className="input-base"
            />
          </Field>

          <Field label="Decision Input Mode" hint="Hide decision buttons in the runtime and rely only on assigned keyboard keys plus the timeout fallback">
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={currentForm.hideDecisionButtons}
                  onChange={(e) => setForm((prev) => prev ? { ...prev, hideDecisionButtons: e.target.checked } : prev)}
                  className="w-4 h-4 accent-primary"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">Hide decision buttons at runtime</span>
                  <span className="text-xs text-muted-foreground">Players can still choose using the keyboard keys assigned to each decision.</span>
                </div>
              </label>

              {currentForm.hideDecisionButtons && (
                <label className="ml-7 flex items-center gap-3 cursor-pointer rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={currentForm.showDecisionInputIndicator}
                    onChange={(e) => setForm((prev) => prev ? { ...prev, showDecisionInputIndicator: e.target.checked } : prev)}
                    className="w-4 h-4 accent-primary"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">Show bottom-screen input indicator</span>
                    <span className="text-xs text-muted-foreground">Displays a small runtime indicator when hidden keyboard decisions become available.</span>
                  </div>
                </label>
              )}
            </div>
          </Field>

          <Field label="Default Locale Code" hint="Used when a locale is not explicitly selected">
            <input
              type="text"
              value={currentForm.defaultLocaleCode}
              onChange={(e) => setForm((prev) => prev ? { ...prev, defaultLocaleCode: e.target.value } : prev)}
              className="input-base font-mono text-sm"
              placeholder="en"
            />
          </Field>

          <Field label="Default Background Color" hint="Used for scene nodes and video-transition composites when no custom background is set">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={currentForm.defaultBackgroundColor}
                onChange={(e) => setForm((prev) => prev ? { ...prev, defaultBackgroundColor: e.target.value } : prev)}
                className="w-10 h-8 rounded border border-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={currentForm.defaultBackgroundColor}
                onChange={(e) => setForm((prev) => prev ? { ...prev, defaultBackgroundColor: e.target.value } : prev)}
                className="input-base font-mono text-sm flex-1"
              />
            </div>
          </Field>

          <Field label="FFmpeg Threads" hint="Leave blank for Auto, or enter the number of CPU cores/threads to use">
            <input
              type="number"
              min={1}
              step={1}
              value={currentForm.ffmpegThreads}
              onChange={(e) => setForm((prev) => prev ? { ...prev, ffmpegThreads: e.target.value } : prev)}
              className="input-base"
              placeholder="Auto"
            />
          </Field>

          {error && (
            <div className="text-sm text-destructive-foreground bg-destructive rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-5">
          <button
            type="submit"
            disabled={saving || !currentForm.name.trim()}
            className="font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ padding: '10px 24px', fontSize: 14 }}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
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
  children: ReactNode
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
