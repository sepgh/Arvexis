import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { listAssets } from '@/api/assets'
import { updateProjectConfig } from '@/api/project'
import { useEditorStore } from '@/store'
import type { Asset, AmbientZone } from '@/types'

interface AmbientZoneForm {
  id: string
  name: string
  assetId: string
  defaultVolume: string
  defaultFadeMs: string
  loop: boolean
}

function toAmbientZoneForm(zone: AmbientZone): AmbientZoneForm {
  return {
    id: zone.id,
    name: zone.name ?? '',
    assetId: zone.assetId ?? '',
    defaultVolume: String(zone.defaultVolume ?? 1),
    defaultFadeMs: String(zone.defaultFadeMs ?? 0),
    loop: zone.loop ?? true,
  }
}

function createAmbientZoneForm(): AmbientZoneForm {
  return {
    id: `ambient-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    assetId: '',
    defaultVolume: '1',
    defaultFadeMs: '0',
    loop: true,
  }
}

function parseAmbientZones(zones: AmbientZoneForm[]): Array<Pick<AmbientZone, 'id' | 'name' | 'assetId' | 'defaultVolume' | 'defaultFadeMs' | 'loop'>> {
  return zones.map((zone, index) => {
    const name = zone.name.trim()
    if (!name) {
      throw new Error(`Ambient zone ${index + 1} must have a name`)
    }
    if (!zone.assetId) {
      throw new Error(`Ambient zone ${name} must select an audio asset`)
    }
    const defaultVolume = Number(zone.defaultVolume)
    if (!Number.isFinite(defaultVolume) || defaultVolume < 0 || defaultVolume > 1) {
      throw new Error(`Ambient zone ${name} default volume must be between 0 and 1`)
    }
    const defaultFadeMs = Number(zone.defaultFadeMs)
    if (!Number.isInteger(defaultFadeMs) || defaultFadeMs < 0) {
      throw new Error(`Ambient zone ${name} default fade must be a whole number of milliseconds`)
    }
    return {
      id: zone.id,
      name,
      assetId: zone.assetId,
      defaultVolume,
      defaultFadeMs,
      loop: zone.loop,
    }
  })
}

export default function AmbientZonesPanel() {
  const projectConfig = useEditorStore((s) => s.projectConfig)
  const setProjectConfig = useEditorStore((s) => s.setProjectConfig)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)
  const [audioAssets, setAudioAssets] = useState<Asset[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zones, setZones] = useState<AmbientZoneForm[]>(() =>
    (projectConfig?.ambientZones ?? []).map(toAmbientZoneForm)
  )

  useEffect(() => {
    setZones((projectConfig?.ambientZones ?? []).map(toAmbientZoneForm))
  }, [projectConfig])

  useEffect(() => {
    listAssets({ mediaType: 'audio' }).then(setAudioAssets).catch(() => {})
  }, [])

  if (!projectConfig) {
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    let ambientZones: Array<Pick<AmbientZone, 'id' | 'name' | 'assetId' | 'defaultVolume' | 'defaultFadeMs' | 'loop'>>
    try {
      ambientZones = parseAmbientZones(zones)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ambient zones are invalid'
      setError(message)
      setSaveStatus('error', message)
      return
    }

    setSaving(true)
    setError(null)
    setSaveStatus('saving')

    try {
      const updated = await updateProjectConfig({ ambientZones })
      setProjectConfig(updated)
      setSaveStatus('saved')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save ambient zones'
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
          <h2 className="font-semibold text-foreground" style={{ fontSize: 18 }}>Ambient Zones</h2>
          <p className="text-xs text-muted-foreground" style={{ marginTop: 4 }}>Reusable ambient audio definitions for scene and transition controls</p>
        </div>
      </div>

      <form className="flex-1 overflow-y-auto" onSubmit={handleSubmit} style={{ padding: 20 }}>
        <div className="flex flex-col gap-4">
          <Field label="Zones" hint="Define named ambient audio presets and reuse them across scenes and transitions.">
            <div className="flex flex-col gap-3">
              {!zones.length && (
                <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                  No ambient zones defined yet.
                </div>
              )}
              {zones.map((zone, index) => (
                <div key={zone.id} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">Zone {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => setZones((prev) => prev.filter((item) => item.id !== zone.id))}
                      className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">Name</label>
                      <input
                        type="text"
                        value={zone.name}
                        onChange={(e) => setZones((prev) => prev.map((item) => item.id === zone.id ? { ...item, name: e.target.value } : item))}
                        className="input-base"
                        placeholder="Forest Night"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">Audio Asset</label>
                      <select
                        value={zone.assetId}
                        onChange={(e) => setZones((prev) => prev.map((item) => item.id === zone.id ? { ...item, assetId: e.target.value } : item))}
                        className="input-base"
                      >
                        <option value="">Select audio asset…</option>
                        {audioAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>{asset.fileName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">Default Volume</label>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={zone.defaultVolume}
                        onChange={(e) => setZones((prev) => prev.map((item) => item.id === zone.id ? { ...item, defaultVolume: e.target.value } : item))}
                        className="input-base"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">Default Fade (ms)</label>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={zone.defaultFadeMs}
                        onChange={(e) => setZones((prev) => prev.map((item) => item.id === zone.id ? { ...item, defaultFadeMs: e.target.value } : item))}
                        className="input-base"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={zone.loop}
                      onChange={(e) => setZones((prev) => prev.map((item) => item.id === zone.id ? { ...item, loop: e.target.checked } : item))}
                      className="w-4 h-4 accent-primary"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">Loop ambient audio</span>
                      <span className="text-xs text-muted-foreground">Disable this for one-shot ambience like stingers or short environmental cues.</span>
                    </div>
                  </label>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setZones((prev) => [...prev, createAmbientZoneForm()])}
                className="self-start rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
              >
                Add Ambient Zone
              </button>
              {!audioAssets.length && (
                <p className="text-xs text-muted-foreground">No scanned audio assets are available yet. Scan assets first, then assign them here.</p>
              )}
            </div>
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
            disabled={saving}
            className="font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ padding: '10px 24px', fontSize: 14 }}
          >
            {saving ? 'Saving…' : 'Save Ambient Zones'}
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
