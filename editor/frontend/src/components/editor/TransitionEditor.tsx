import { useState, useEffect } from 'react'
import type { AmbientAction, AmbientConfig, AmbientConfigRequest, TransitionResponse, TransitionType, Asset, TransitionLayerData, TransitionAudioData } from '@/types'
import { getTransition, setTransitionType, saveTransitionLayers, saveTransitionAudio, setTransitionBackgroundColor, setTransitionAmbient } from '@/api/transition'
import type { VideoLayerRequest, AudioTrackRequest } from '@/api/nodeEditor'
import { listAssets } from '@/api/assets'
import { recordHistoryEntry } from '@/history'
import { startTransitionPreview, type PreviewJobStatus } from '@/api/preview'
import { useEditorStore } from '@/store'
import PreviewModal from './PreviewModal'

const TRANSITION_TYPES: { value: TransitionType; label: string }[] = [
  { value: 'none',       label: 'None (instant)' },
  { value: 'cut',        label: 'Cut' },
  { value: 'fade_in',    label: 'Fade in' },
  { value: 'fade_out',   label: 'Fade out' },
  { value: 'crossfade',  label: 'Crossfade' },
  { value: 'slide_left', label: 'Slide left' },
  { value: 'slide_right',label: 'Slide right' },
  { value: 'wipe',       label: 'Wipe' },
  { value: 'dissolve',   label: 'Dissolve' },
  { value: 'video',      label: 'Video (custom layers)' },
]

interface TransitionEditorProps { edgeId: string }

type Section = 'config' | 'layers' | 'audio'

function normalizeAmbientAction(action: AmbientConfig['action'] | null | undefined): AmbientAction {
  if (action === 'set' || action === 'stop') {
    return action
  }
  return 'inherit'
}

function buildAmbientRequest(
  action: AmbientAction,
  zoneId: string,
  useVolumeOverride: boolean,
  volumeOverride: string,
  useFadeOverride: boolean,
  fadeMsOverride: string,
): AmbientConfigRequest {
  if (action === 'stop') {
    return {
      action,
      clearVolumeOverride: true,
      clearFadeMsOverride: true,
    }
  }
  const request: AmbientConfigRequest = {
    action,
    clearVolumeOverride: !useVolumeOverride,
    clearFadeMsOverride: !useFadeOverride,
  }
  if (action === 'set') {
    if (!zoneId.trim()) {
      throw new Error('Ambient action "Set zone" requires an ambient zone')
    }
    request.zoneId = zoneId.trim()
  }
  if (useVolumeOverride) {
    const parsedVolume = Number(volumeOverride)
    if (!Number.isFinite(parsedVolume) || parsedVolume < 0 || parsedVolume > 1) {
      throw new Error('Ambient volume override must be between 0 and 1')
    }
    request.volumeOverride = parsedVolume
  }
  if (useFadeOverride) {
    const parsedFadeMs = Number(fadeMsOverride)
    if (!Number.isInteger(parsedFadeMs) || parsedFadeMs < 0) {
      throw new Error('Ambient fade override must be a whole number of milliseconds')
    }
    request.fadeMsOverride = parsedFadeMs
  }
  return request
}

function buildExplicitAmbientRequest(ambient: AmbientConfig | null | undefined): AmbientConfigRequest {
  if (!ambient) {
    return {
      action: 'inherit',
      clearVolumeOverride: true,
      clearFadeMsOverride: true,
    }
  }
  return buildAmbientRequest(
    normalizeAmbientAction(ambient.action),
    ambient.zoneId ?? '',
    ambient.volumeOverride != null,
    ambient.volumeOverride != null ? String(ambient.volumeOverride) : '1',
    ambient.fadeMsOverride != null,
    ambient.fadeMsOverride != null ? String(ambient.fadeMsOverride) : '0',
  )
}

function normalizeHexColor(value: string): string {
  const normalized = value.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error('Transition background color must be a hex color like #ffffff')
  }
  return normalized
}

export default function TransitionEditor({ edgeId }: TransitionEditorProps) {
  const projectConfig = useEditorStore((s) => s.projectConfig)
  const ambientZones = projectConfig?.ambientZones ?? []
  const [data, setData]       = useState<TransitionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [section, setSection] = useState<Section>('config')
  const [videoAssets, setVideoAssets] = useState<Asset[]>([])
  const [audioAssets, setAudioAssets] = useState<Asset[]>([])
  const [durationInput, setDurationInput] = useState('')
  const [useCustomBackgroundColor, setUseCustomBackgroundColor] = useState(false)
  const [bgColorInput, setBgColorInput]   = useState('#ffffff')
  const [ambientAction, setAmbientAction] = useState<AmbientAction>('inherit')
  const [ambientZoneId, setAmbientZoneId] = useState('')
  const [useAmbientVolumeOverride, setUseAmbientVolumeOverride] = useState(false)
  const [ambientVolumeOverride, setAmbientVolumeOverride] = useState('1')
  const [useAmbientFadeOverride, setUseAmbientFadeOverride] = useState(false)
  const [ambientFadeMsOverride, setAmbientFadeMsOverride] = useState('0')
  const [previewJob, setPreviewJob]   = useState<PreviewJobStatus | null>(null)
  const [previewing, setPreviewing]   = useState(false)

  async function handlePreview() {
    setPreviewing(true)
    try {
      const job = await startTransitionPreview(edgeId)
      setPreviewJob(job)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  function applyTransitionData(transition: TransitionResponse) {
    setData(transition)
    setDurationInput(transition.duration != null ? String(transition.duration) : '')
    setUseCustomBackgroundColor(transition.backgroundColor != null)
    setBgColorInput(transition.backgroundColor ?? '#ffffff')
    setAmbientAction(normalizeAmbientAction(transition.ambient?.action))
    setAmbientZoneId(transition.ambient?.zoneId ?? '')
    setUseAmbientVolumeOverride(transition.ambient?.volumeOverride != null)
    setAmbientVolumeOverride(transition.ambient?.volumeOverride != null ? String(transition.ambient.volumeOverride) : '1')
    setUseAmbientFadeOverride(transition.ambient?.fadeMsOverride != null)
    setAmbientFadeMsOverride(transition.ambient?.fadeMsOverride != null ? String(transition.ambient.fadeMsOverride) : '0')
  }

  async function refreshTransitionSelection() {
    const transition = await getTransition(edgeId)
    applyTransitionData(transition)
    useEditorStore.getState().setSelectedEdgeId(edgeId)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getTransition(edgeId),
      listAssets({ mediaType: 'video' }),
      listAssets({ mediaType: 'audio' }),
    ])
      .then(([d, v, a]) => {
        applyTransitionData(d)
        setVideoAssets(v)
        setAudioAssets(a)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [edgeId])

  async function withSave<T>(fn: () => Promise<T>): Promise<T | null> {
    setSaving(true); setError(null)
    try { return await fn() }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Save failed'); return null }
    finally { setSaving(false) }
  }

  async function handleTypeChange(type: TransitionType) {
    if (!data) return
    const dur = parseFloat(durationInput)
    const previousType = data.type ?? 'none'
    const previousDuration = data.duration ?? null
    const nextDuration = !isNaN(dur) && dur > 0 ? dur : null
    if (previousType === type && previousDuration === nextDuration) {
      return
    }
    const result = await withSave(() =>
      setTransitionType(edgeId, type, nextDuration ?? undefined))
    if (result) {
      applyTransitionData(result)
      recordHistoryEntry({
        label: 'Update Edge Transition',
        undo: async () => {
          await setTransitionType(edgeId, previousType, previousDuration ?? undefined)
          await refreshTransitionSelection()
        },
        redo: async () => {
          await setTransitionType(edgeId, type, nextDuration ?? undefined)
          await refreshTransitionSelection()
        },
      })
    }
  }

  async function handleDurationBlur() {
    if (!data) return
    const dur = parseFloat(durationInput)
    if (isNaN(dur)) return
    const type = data.type ?? 'none'
    const previousDuration = data.duration ?? null
    const nextDuration = dur > 0 ? dur : null
    if (previousDuration === nextDuration) {
      return
    }
    const result = await withSave(() => setTransitionType(edgeId, type, nextDuration ?? undefined))
    if (result) {
      applyTransitionData(result)
      recordHistoryEntry({
        label: 'Update Edge Transition',
        undo: async () => {
          await setTransitionType(edgeId, type, previousDuration ?? undefined)
          await refreshTransitionSelection()
        },
        redo: async () => {
          await setTransitionType(edgeId, type, nextDuration ?? undefined)
          await refreshTransitionSelection()
        },
      })
    }
  }

  async function handleBackgroundColorSave(nextUseCustomBackgroundColor = useCustomBackgroundColor) {
    try {
      if (!data) return
      const previousBackgroundColor = data.backgroundColor ?? null
      const nextBackgroundColor = nextUseCustomBackgroundColor ? normalizeHexColor(bgColorInput) : null
      if (previousBackgroundColor === nextBackgroundColor) {
        return
      }

      const result = await withSave(() => setTransitionBackgroundColor(edgeId, nextBackgroundColor))
      if (result) {
        applyTransitionData(result)
        recordHistoryEntry({
          label: 'Update Edge Background',
          undo: async () => {
            await setTransitionBackgroundColor(edgeId, previousBackgroundColor)
            await refreshTransitionSelection()
          },
          redo: async () => {
            await setTransitionBackgroundColor(edgeId, nextBackgroundColor)
            await refreshTransitionSelection()
          },
        })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Transition background color is invalid')
    }
  }

  async function handleAmbientSave() {
    try {
      if (!data) return
      const previousAmbient = buildExplicitAmbientRequest(data.ambient)
      const nextAmbient = buildAmbientRequest(
        ambientAction,
        ambientZoneId,
        useAmbientVolumeOverride,
        ambientVolumeOverride,
        useAmbientFadeOverride,
        ambientFadeMsOverride,
      )
      if (JSON.stringify(previousAmbient) === JSON.stringify(nextAmbient)) {
        return
      }
      const result = await withSave(() => setTransitionAmbient(edgeId, nextAmbient))
      if (result) {
        applyTransitionData(result)
        recordHistoryEntry({
          label: 'Update Edge Ambient',
          undo: async () => {
            await setTransitionAmbient(edgeId, previousAmbient)
            await refreshTransitionSelection()
          },
          redo: async () => {
            await setTransitionAmbient(edgeId, nextAmbient)
            await refreshTransitionSelection()
          },
        })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ambient settings are invalid')
    }
  }

  function toLayerReq(l: TransitionLayerData): VideoLayerRequest {
    return { assetId: l.assetId, startAt: l.startAt, startAtFrames: l.startAtFrames, freezeLastFrame: l.freezeLastFrame, loopLayer: false }
  }

  async function updateLayerStartAt(layerId: number, startAt: number) {
    if (!data) return
    const layers = data.videoLayers.map(l =>
      ({ ...toLayerReq(l), ...(l.id === layerId ? { startAt } : {}) })
    )
    const result = await withSave(() => saveTransitionLayers(edgeId, layers))
    if (result) setData(result)
  }

  async function updateLayerStartAtFrames(layerId: number, startAtFrames: number | null) {
    if (!data) return
    const layers = data.videoLayers.map(l =>
      ({ ...toLayerReq(l), ...(l.id === layerId ? { startAtFrames } : {}) })
    )
    const result = await withSave(() => saveTransitionLayers(edgeId, layers))
    if (result) setData(result)
  }

  async function addVideoLayer(asset: Asset) {
    if (!data) return
    const layers: VideoLayerRequest[] = [
      ...data.videoLayers.map(toLayerReq),
      { assetId: asset.id, startAt: 0, startAtFrames: null, freezeLastFrame: false, loopLayer: false },
    ]
    const result = await withSave(() => saveTransitionLayers(edgeId, layers))
    if (result) setData(result)
  }

  async function removeVideoLayer(layerId: number) {
    if (!data) return
    const layers = data.videoLayers.filter(l => l.id !== layerId).map(toLayerReq)
    const result = await withSave(() => saveTransitionLayers(edgeId, layers))
    if (result) setData(result)
  }

  async function moveVideoLayer(layerId: number, dir: -1 | 1) {
    if (!data) return
    const arr = [...data.videoLayers]
    const idx = arr.findIndex(l => l.id === layerId)
    if (idx + dir < 0 || idx + dir >= arr.length) return
    ;[arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]]
    const result = await withSave(() => saveTransitionLayers(edgeId, arr.map(toLayerReq)))
    if (result) setData(result)
  }

  async function updateLayerFreeze(layerId: number, freezeLastFrame: boolean) {
    if (!data) return
    const layers = data.videoLayers.map(l =>
      ({ ...toLayerReq(l), ...(l.id === layerId ? { freezeLastFrame } : {}) })
    )
    const result = await withSave(() => saveTransitionLayers(edgeId, layers))
    if (result) setData(result)
  }

  function toAudioReq(t: TransitionAudioData): AudioTrackRequest {
    return { assetId: t.assetId, startAt: t.startAt, startAtFrames: t.startAtFrames }
  }

  async function addAudioTrack(asset: Asset) {
    if (!data) return
    const tracks: AudioTrackRequest[] = [
      ...data.audioTracks.map(toAudioReq),
      { assetId: asset.id, startAt: 0, startAtFrames: null },
    ]
    const result = await withSave(() => saveTransitionAudio(edgeId, tracks))
    if (result) setData(result)
  }

  async function removeAudioTrack(trackId: number) {
    if (!data) return
    const tracks = data.audioTracks.filter(t => t.id !== trackId).map(toAudioReq)
    const result = await withSave(() => saveTransitionAudio(edgeId, tracks))
    if (result) setData(result)
  }

  async function updateAudioStartAt(trackId: number, startAt: number) {
    if (!data) return
    const tracks = data.audioTracks.map(t =>
      ({ ...toAudioReq(t), ...(t.id === trackId ? { startAt } : {}) })
    )
    const result = await withSave(() => saveTransitionAudio(edgeId, tracks))
    if (result) setData(result)
  }

  async function updateAudioStartAtFrames(trackId: number, startAtFrames: number | null) {
    if (!data) return
    const tracks = data.audioTracks.map(t =>
      ({ ...toAudioReq(t), ...(t.id === trackId ? { startAtFrames } : {}) })
    )
    const result = await withSave(() => saveTransitionAudio(edgeId, tracks))
    if (result) setData(result)
  }

  if (loading) return <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">Loading…</div>

  if (data && !data.transitionAllowed) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 gap-3 text-center">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl">⛔</div>
        <p className="text-sm font-medium text-foreground">Transition not available</p>
        <p className="text-xs text-muted-foreground">
          Transitions can only be configured on edges whose target is a <strong>Scene</strong> node.
          This edge targets a <span className="text-foreground font-medium">{data.targetNodeType}</span> node.
        </p>
      </div>
    )
  }

  const isVideo = data?.type === 'video'
  const selectedAmbientZone = ambientZones.find((zone) => zone.id === ambientZoneId)
  const ambientOverridesEnabled = ambientAction !== 'stop'

  const SECTIONS: { id: Section; label: string; show: boolean }[] = [
    { id: 'config', label: 'Type',   show: true },
    { id: 'layers', label: 'Layers', show: !!isVideo },
    { id: 'audio',  label: 'Audio',  show: !!isVideo },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {error && <div className="mx-3 my-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}

      {previewJob && (
        <PreviewModal
          initialJob={previewJob}
          title="Transition preview"
          onClose={() => setPreviewJob(null)}
        />
      )}

      <div className="px-5 py-3 text-sm text-muted-foreground border-b border-border/50 flex items-center justify-between">
        <span>→ <span className="text-foreground">{data?.targetNodeType ?? '…'}</span> node</span>
        <div className="flex items-center gap-2">
          {saving && <span>Saving…</span>}
          {data?.transitionAllowed && (
            <button
              onClick={handlePreview}
              disabled={previewing}
              className="text-sm px-3 py-1.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-50 transition-colors border border-primary/30"
            >
              {previewing ? '…' : '▶ Preview'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {SECTIONS.filter(s => s.show).map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={[
              'flex-1 py-3 text-sm font-medium transition-colors',
              section === s.id ? 'text-foreground border-b-2 border-primary -mb-px' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {/* Config section */}
        {section === 'config' && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-muted-foreground">Transition type</label>
              <select
                value={data?.type ?? 'none'}
                onChange={e => handleTypeChange(e.target.value as TransitionType)}
                className="input-base text-xs py-1.5"
              >
                {TRANSITION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {data?.type && data.type !== 'none' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-muted-foreground">Duration (max 5s)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="0" max="5" step="0.1"
                    value={durationInput}
                    onChange={e => setDurationInput(e.target.value)}
                    onBlur={handleDurationBlur}
                    className="input-base text-xs py-1 w-24"
                    placeholder="0.0"
                  />
                  <span className="text-xs text-muted-foreground">s</span>
                </div>
              </div>
            )}

            {isVideo && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-muted-foreground">Background colour</label>
                  <p className="text-xs text-muted-foreground">
                    Composited behind video layers with alpha channel.
                  </p>
                  <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCustomBackgroundColor}
                        onChange={e => {
                          const checked = e.target.checked
                          setUseCustomBackgroundColor(checked)
                          if (!checked) {
                            void handleBackgroundColorSave(false)
                          }
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                      <div>
                        <span className="text-sm font-medium text-foreground">Use transition-specific background</span>
                        <p className="text-xs text-muted-foreground">Leave off to use the inherited/default background color.</p>
                      </div>
                    </label>
                    {useCustomBackgroundColor ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={bgColorInput}
                          onChange={e => setBgColorInput(e.target.value)}
                          onBlur={() => { void handleBackgroundColorSave() }}
                          className="w-10 h-8 rounded cursor-pointer border border-border bg-transparent"
                        />
                        <input
                          type="text"
                          value={bgColorInput}
                          onChange={e => setBgColorInput(e.target.value)}
                          onBlur={() => { void handleBackgroundColorSave() }}
                          className="input-base text-xs py-1 w-28 font-mono"
                          placeholder="#ffffff"
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
                        <span className="text-xs font-medium text-foreground">Using inherited/default background</span>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2.5">
                  Video transition uses custom video layers and audio tracks — configure in the Layers and Audio tabs.
                </p>
              </>
            )}

            <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-3">
              <div>
                <span className="text-sm font-medium text-foreground">Ambient audio</span>
                <p className="text-xs text-muted-foreground" style={{ marginTop: 4 }}>
                  Applied when this edge is taken, independently of the visual transition type.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-muted-foreground">Action</label>
                <select
                  value={ambientAction}
                  onChange={e => {
                    const nextAction = e.target.value as AmbientAction
                    setAmbientAction(nextAction)
                    if (nextAction === 'set' && !ambientZoneId && ambientZones[0]) {
                      setAmbientZoneId(ambientZones[0].id)
                    }
                  }}
                  className="input-base text-xs py-1.5"
                >
                  <option value="inherit">Inherit current ambient</option>
                  <option value="set">Set ambient zone</option>
                  <option value="stop">Stop ambient</option>
                </select>
              </div>
              {ambientAction === 'inherit' && (
                <p className="text-xs text-muted-foreground">Keeps the currently active ambient track and can optionally rebalance its volume without restarting it.</p>
              )}
              {ambientAction === 'stop' && (
                <p className="text-xs text-muted-foreground">Stops the active ambient layer when this edge is used.</p>
              )}
              {ambientOverridesEnabled && (
                <div className="flex flex-col gap-3">
                  {ambientAction === 'set' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm text-muted-foreground">Ambient zone</label>
                        <select
                          value={ambientZoneId}
                          onChange={e => setAmbientZoneId(e.target.value)}
                          className="input-base text-xs py-1.5"
                          disabled={!ambientZones.length}
                        >
                          <option value="">Select ambient zone…</option>
                          {ambientZones.map((zone) => (
                            <option key={zone.id} value={zone.id}>{zone.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
                        <span className="text-xs font-medium text-foreground">Zone defaults</span>
                        {selectedAmbientZone ? (
                          <p className="text-xs text-muted-foreground" style={{ marginTop: 4 }}>
                            {selectedAmbientZone.assetFileName ?? selectedAmbientZone.assetId} · volume {selectedAmbientZone.defaultVolume.toFixed(2)} · fade {selectedAmbientZone.defaultFadeMs}ms{selectedAmbientZone.loop ? ' · loop' : ''}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground" style={{ marginTop: 4 }}>
                            {ambientZones.length ? 'Choose a zone to inspect its defaults.' : 'Create ambient zones in the Ambient panel first.'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={useAmbientVolumeOverride}
                        onChange={e => {
                          const checked = e.target.checked
                          setUseAmbientVolumeOverride(checked)
                          if (checked) {
                            setAmbientVolumeOverride(
                              ambientAction === 'set' && selectedAmbientZone
                                ? String(selectedAmbientZone.defaultVolume)
                                : ambientVolumeOverride || '1'
                            )
                          }
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">Override volume</span>
                        <span className="text-xs text-muted-foreground">Adjust the target ambient volume for this edge without forcing a track restart.</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={useAmbientFadeOverride}
                        onChange={e => {
                          const checked = e.target.checked
                          setUseAmbientFadeOverride(checked)
                          if (checked) {
                            setAmbientFadeMsOverride(
                              ambientAction === 'set' && selectedAmbientZone
                                ? String(selectedAmbientZone.defaultFadeMs)
                                : ambientFadeMsOverride || '0'
                            )
                          }
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">Override fade</span>
                        <span className="text-xs text-muted-foreground">Set how quickly this edge adjusts or swaps ambient playback.</span>
                      </div>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm text-muted-foreground">Volume override</label>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={ambientVolumeOverride}
                        onChange={e => setAmbientVolumeOverride(e.target.value)}
                        disabled={!useAmbientVolumeOverride}
                        className="input-base text-xs py-1"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm text-muted-foreground">Fade override (ms)</label>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={ambientFadeMsOverride}
                        onChange={e => setAmbientFadeMsOverride(e.target.value)}
                        disabled={!useAmbientFadeOverride}
                        className="input-base text-xs py-1"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAmbientSave}
                  disabled={saving}
                  className="rounded-md bg-primary text-primary-foreground disabled:opacity-40 transition-opacity px-3 py-1.5 text-sm font-medium"
                >
                  Save ambient
                </button>
              </div>
            </div>
          </>
        )}

        {/* Video layers (only for video transition) */}
        {section === 'layers' && isVideo && (
          <>
            {data?.videoLayers.map((vl, i) => (
              <VideoLayerRow
                key={vl.id} layer={vl} index={i} total={data.videoLayers.length}
                onRemove={() => removeVideoLayer(vl.id)}
                onMoveUp={() => moveVideoLayer(vl.id, -1)}
                onMoveDown={() => moveVideoLayer(vl.id, 1)}
                onStartAtChange={v => updateLayerStartAt(vl.id, v)}
                onStartAtFramesChange={v => updateLayerStartAtFrames(vl.id, v)}
                onFreezeChange={v => updateLayerFreeze(vl.id, v)}
              />
            ))}
            {!data?.videoLayers.length && (
              <p className="text-xs text-muted-foreground text-center py-4">No video layers.</p>
            )}
            <AssetPicker label="Add video layer" assets={videoAssets} onPick={addVideoLayer} />
          </>
        )}

        {/* Audio tracks (only for video transition) */}
        {section === 'audio' && isVideo && (
          <>
            {data?.audioTracks.map((t, i) => (
              <AudioTrackRow
                key={t.id} track={t} index={i}
                onRemove={() => removeAudioTrack(t.id)}
                onStartAtChange={v => updateAudioStartAt(t.id, v)}
                onStartAtFramesChange={v => updateAudioStartAtFrames(t.id, v)}
              />
            ))}
            {!data?.audioTracks.length && (
              <p className="text-xs text-muted-foreground text-center py-4">No audio tracks.</p>
            )}
            <AssetPicker label="Add audio track" assets={audioAssets} onPick={addAudioTrack} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VideoLayerRow({ layer, index, total, onRemove, onMoveUp, onMoveDown, onStartAtChange, onStartAtFramesChange, onFreezeChange }: {
  layer: TransitionLayerData; index: number; total: number
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void
  onStartAtChange: (v: number) => void
  onStartAtFramesChange: (v: number | null) => void
  onFreezeChange: (v: boolean) => void
}) {
  const [localMs, setLocalMs] = useState(String(Math.round(layer.startAt * 1000)))
  const [localFrames, setLocalFrames] = useState(layer.startAtFrames != null ? String(layer.startAtFrames) : '')
  const hasFrames = layer.startAtFrames != null

  useEffect(() => {
    setLocalMs(String(Math.round(layer.startAt * 1000)))
    setLocalFrames(layer.startAtFrames != null ? String(layer.startAtFrames) : '')
  }, [layer.startAt, layer.startAtFrames])

  return (
    <div className={['rounded-lg border p-2.5 flex flex-col gap-2',
      layer.alphaError ? 'border-red-500/60 bg-red-500/5' : 'border-border/50 bg-muted/40',
    ].join(' ')}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-5 shrink-0">#{index + 1}</span>
        {layer.hasAlpha && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">α</span>}
        <span className="flex-1 text-sm text-foreground truncate">{layer.assetFileName}</span>
        {layer.alphaError && <span className="text-xs text-red-400 shrink-0">no α</span>}
        <div className="flex gap-0.5">
          <button onClick={onMoveUp}   disabled={index === 0}         className="w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs">↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs">↓</button>
          <button onClick={onRemove} className="w-5 h-5 text-muted-foreground hover:text-red-400 flex items-center justify-center">×</button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">start-at</label>
        <input
          type="number" min="0" step="1"
          value={localMs}
          onChange={e => setLocalMs(e.target.value)}
          onBlur={() => { const v = parseInt(localMs); if (!isNaN(v) && v >= 0) onStartAtChange(v / 1000) }}
          className={`input-base text-xs py-0.5 w-20 ${hasFrames ? 'opacity-40' : ''}`}
        />
        <span className="text-[10px] text-muted-foreground">ms</span>
        <input
          type="number" min="0" step="1"
          value={localFrames}
          onChange={e => setLocalFrames(e.target.value)}
          onBlur={() => {
            if (localFrames.trim() === '') { onStartAtFramesChange(null) }
            else { const v = parseInt(localFrames); if (!isNaN(v) && v >= 0) onStartAtFramesChange(v) }
          }}
          className={`input-base text-xs py-0.5 w-16 ${hasFrames ? 'ring-1 ring-primary/50' : ''}`}
          placeholder="—"
        />
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">FPS</span>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={layer.freezeLastFrame}
          onChange={e => onFreezeChange(e.target.checked)}
          className="w-3.5 h-3.5 accent-primary"
        />
        <span className="text-[11px] text-muted-foreground">Hold last frame</span>
      </label>
    </div>
  )
}

function AudioTrackRow({ track, index, onRemove, onStartAtChange, onStartAtFramesChange }: {
  track: TransitionAudioData; index: number; onRemove: () => void
  onStartAtChange: (v: number) => void
  onStartAtFramesChange: (v: number | null) => void
}) {
  const [localMs, setLocalMs] = useState(String(Math.round(track.startAt * 1000)))
  const [localFrames, setLocalFrames] = useState(track.startAtFrames != null ? String(track.startAtFrames) : '')
  const hasFrames = track.startAtFrames != null

  useEffect(() => {
    setLocalMs(String(Math.round(track.startAt * 1000)))
    setLocalFrames(track.startAtFrames != null ? String(track.startAtFrames) : '')
  }, [track.startAt, track.startAtFrames])

  return (
    <div className="rounded-lg border border-border/50 bg-muted/40 p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-5 shrink-0">#{index + 1}</span>
        <span className="flex-1 text-sm truncate">{track.assetFileName}</span>
        {track.duration != null && <span className="text-xs text-muted-foreground">{track.duration.toFixed(1)}s</span>}
        <button onClick={onRemove} className="w-5 h-5 text-muted-foreground hover:text-red-400 flex items-center justify-center">×</button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">start-at</label>
        <input
          type="number" min="0" step="1"
          value={localMs}
          onChange={e => setLocalMs(e.target.value)}
          onBlur={() => { const v = parseInt(localMs); if (!isNaN(v) && v >= 0) onStartAtChange(v / 1000) }}
          className={`input-base text-xs py-0.5 w-20 ${hasFrames ? 'opacity-40' : ''}`}
        />
        <span className="text-[10px] text-muted-foreground">ms</span>
        <input
          type="number" min="0" step="1"
          value={localFrames}
          onChange={e => setLocalFrames(e.target.value)}
          onBlur={() => {
            if (localFrames.trim() === '') { onStartAtFramesChange(null) }
            else { const v = parseInt(localFrames); if (!isNaN(v) && v >= 0) onStartAtFramesChange(v) }
          }}
          className={`input-base text-xs py-0.5 w-16 ${hasFrames ? 'ring-1 ring-primary/50' : ''}`}
          placeholder="—"
        />
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">FPS</span>
      </div>
    </div>
  )
}

function AssetPicker({ label, assets, onPick }: { label: string; assets: Asset[]; onPick: (a: Asset) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  if (!assets.length) return <p className="text-sm text-muted-foreground text-center py-2">No assets scanned yet.</p>

  const filtered = search
    ? assets.filter(a => a.fileName.toLowerCase().includes(search.toLowerCase()))
    : assets

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-sm text-primary hover:underline text-left font-medium"
      >
        {open ? '▲' : '▼'} {label}
      </button>
      {open && (
        <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-muted/20">
          <div className="p-2 border-b border-border/50">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search assets…"
              className="input-base text-sm py-1.5 w-full"
              autoFocus
            />
          </div>
          <div className="flex flex-col max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No matching assets</p>
            ) : (
              filtered.map(a => (
                <button
                  key={a.id}
                  onClick={() => { onPick(a); setOpen(false); setSearch('') }}
                  className="text-left px-4 py-2.5 text-sm text-foreground hover:bg-accent border-b border-border/30 last:border-0 flex items-center gap-3"
                >
                  {a.mediaType === 'video' && a.hasAlpha && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">α</span>
                  )}
                  <span className="flex-1 truncate">{a.fileName}</span>
                  {a.duration != null && <span className="text-muted-foreground shrink-0">{a.duration.toFixed(1)}s</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
