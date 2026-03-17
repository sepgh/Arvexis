import { useState, useEffect } from 'react'
import type { TransitionResponse, TransitionType, Asset, TransitionLayerData, TransitionAudioData } from '@/types'
import { getTransition, setTransitionType, saveTransitionLayers, saveTransitionAudio } from '@/api/transition'
import type { VideoLayerRequest, AudioTrackRequest } from '@/api/nodeEditor'
import { listAssets } from '@/api/assets'
import { startTransitionPreview, type PreviewJobStatus } from '@/api/preview'
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

export default function TransitionEditor({ edgeId }: TransitionEditorProps) {
  const [data, setData]       = useState<TransitionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [section, setSection] = useState<Section>('config')
  const [videoAssets, setVideoAssets] = useState<Asset[]>([])
  const [audioAssets, setAudioAssets] = useState<Asset[]>([])
  const [durationInput, setDurationInput] = useState('')
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

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getTransition(edgeId),
      listAssets({ mediaType: 'video' }),
      listAssets({ mediaType: 'audio' }),
    ])
      .then(([d, v, a]) => {
        setData(d)
        setDurationInput(d.duration != null ? String(d.duration) : '')
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
    const dur = parseFloat(durationInput)
    const result = await withSave(() =>
      setTransitionType(edgeId, type, !isNaN(dur) && dur > 0 ? dur : undefined))
    if (result) setData(result)
  }

  async function handleDurationBlur() {
    if (!data) return
    const dur = parseFloat(durationInput)
    if (isNaN(dur)) return
    const type = data.type ?? 'none'
    const result = await withSave(() => setTransitionType(edgeId, type, dur > 0 ? dur : undefined))
    if (result) setData(result)
  }

  // Video layers
  async function addVideoLayer(asset: Asset) {
    if (!data) return
    const layers: VideoLayerRequest[] = [
      ...data.videoLayers.map(l => ({ assetId: l.assetId, startAt: l.startAt })),
      { assetId: asset.id, startAt: 0 },
    ]
    const result = await withSave(() => saveTransitionLayers(edgeId, layers))
    if (result) setData(result)
  }

  async function removeVideoLayer(layerId: number) {
    if (!data) return
    const layers = data.videoLayers.filter(l => l.id !== layerId)
      .map(l => ({ assetId: l.assetId, startAt: l.startAt }))
    const result = await withSave(() => saveTransitionLayers(edgeId, layers))
    if (result) setData(result)
  }

  async function moveVideoLayer(layerId: number, dir: -1 | 1) {
    if (!data) return
    const arr = [...data.videoLayers]
    const idx = arr.findIndex(l => l.id === layerId)
    if (idx + dir < 0 || idx + dir >= arr.length) return
    ;[arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]]
    const result = await withSave(() => saveTransitionLayers(edgeId, arr.map(l => ({ assetId: l.assetId, startAt: l.startAt }))))
    if (result) setData(result)
  }

  // Audio tracks
  async function addAudioTrack(asset: Asset) {
    if (!data) return
    const tracks: AudioTrackRequest[] = [
      ...data.audioTracks.map(t => ({ assetId: t.assetId, startAt: t.startAt })),
      { assetId: asset.id, startAt: 0 },
    ]
    const result = await withSave(() => saveTransitionAudio(edgeId, tracks))
    if (result) setData(result)
  }

  async function removeAudioTrack(trackId: number) {
    if (!data) return
    const tracks = data.audioTracks.filter(t => t.id !== trackId)
      .map(t => ({ assetId: t.assetId, startAt: t.startAt }))
    const result = await withSave(() => saveTransitionAudio(edgeId, tracks))
    if (result) setData(result)
  }

  if (loading) return <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">Loading…</div>

  // Non-scene target: show disabled message
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

      <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/50 flex items-center justify-between">
        <span>→ <span className="text-foreground">{data?.targetNodeType ?? '…'}</span> node</span>
        <div className="flex items-center gap-2">
          {saving && <span>Saving…</span>}
          {data?.transitionAllowed && (
            <button
              onClick={handlePreview}
              disabled={previewing}
              className="text-xs px-2 py-0.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-50 transition-colors border border-primary/30"
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
              'flex-1 py-2 text-xs font-medium transition-colors',
              section === s.id ? 'text-foreground border-b-2 border-primary -mb-px' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {/* Config section */}
        {section === 'config' && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Transition type</label>
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
                <label className="text-xs text-muted-foreground">Duration (max 5s)</label>
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
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2.5">
                Video transition uses custom video layers and audio tracks — configure in the Layers and Audio tabs.
              </p>
            )}
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

function VideoLayerRow({ layer, index, total, onRemove, onMoveUp, onMoveDown }: {
  layer: TransitionLayerData; index: number; total: number
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  return (
    <div className={['rounded-lg border p-2.5 flex items-center gap-2',
      layer.alphaError ? 'border-red-500/60 bg-red-500/5' : 'border-border/50 bg-muted/40',
    ].join(' ')}>
      <span className="text-[10px] text-muted-foreground w-4 shrink-0">#{index + 1}</span>
      {layer.hasAlpha && <span className="text-[9px] px-1 py-px rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">α</span>}
      <span className="flex-1 text-xs text-foreground truncate">{layer.assetFileName}</span>
      {layer.alphaError && <span className="text-[10px] text-red-400 shrink-0">no α</span>}
      <div className="flex gap-0.5">
        <button onClick={onMoveUp}   disabled={index === 0}         className="w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs">↑</button>
        <button onClick={onMoveDown} disabled={index === total - 1} className="w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs">↓</button>
        <button onClick={onRemove} className="w-5 h-5 text-muted-foreground hover:text-red-400 flex items-center justify-center">×</button>
      </div>
    </div>
  )
}

function AudioTrackRow({ track, index, onRemove }: {
  track: TransitionAudioData; index: number; onRemove: () => void
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/40 p-2.5 flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-4 shrink-0">#{index + 1}</span>
      <span className="flex-1 text-xs truncate">{track.assetFileName}</span>
      {track.duration != null && <span className="text-[10px] text-muted-foreground">{track.duration.toFixed(1)}s</span>}
      <button onClick={onRemove} className="w-5 h-5 text-muted-foreground hover:text-red-400 flex items-center justify-center">×</button>
    </div>
  )
}

function AssetPicker({ label, assets, onPick }: { label: string; assets: Asset[]; onPick: (a: Asset) => void }) {
  const [open, setOpen] = useState(false)
  if (!assets.length) return <p className="text-xs text-muted-foreground text-center py-1">No assets scanned yet.</p>
  return (
    <div className="flex flex-col gap-1">
      <button onClick={() => setOpen(o => !o)} className="text-xs text-primary hover:underline text-left">
        {open ? '▲' : '▼'} {label}
      </button>
      {open && (
        <div className="flex flex-col border border-border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
          {assets.map(a => (
            <button key={a.id} onClick={() => { onPick(a); setOpen(false) }}
              className="text-left px-3 py-1.5 text-xs hover:bg-accent border-b border-border/30 last:border-0 flex items-center gap-2">
              {a.mediaType === 'video' && a.hasAlpha && (
                <span className="text-[9px] px-1 py-px rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">α</span>
              )}
              <span className="truncate">{a.fileName}</span>
              {a.duration != null && <span className="text-muted-foreground shrink-0">{a.duration.toFixed(1)}s</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
