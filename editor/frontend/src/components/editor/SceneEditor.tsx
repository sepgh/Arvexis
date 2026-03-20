import { useState, useEffect } from 'react'
import type { SceneDataResponse, VideoLayerData, AudioTrackData, Asset } from '@/types'
import {
  getSceneData, saveVideoLayers, saveAudioTracks, saveDecisions,
  type VideoLayerRequest, type AudioTrackRequest, type DecisionItemRequest,
} from '@/api/nodeEditor'
import { listAssets } from '@/api/assets'
import { updateNode } from '@/api/graph'
import { startScenePreview, type PreviewJobStatus } from '@/api/preview'
import { useEditorStore } from '@/store'
import PreviewModal from './PreviewModal'

interface SceneEditorProps {
  nodeId: string
  isEnd: boolean
  autoContinue: boolean
  backgroundColor: string | null
  musicAssetId: string | null
}

type Section = 'layers' | 'audio' | 'decisions' | 'props'

export default function SceneEditor({ nodeId, isEnd: initialIsEnd, autoContinue: initialAutoContinue, backgroundColor: initialBg, musicAssetId: initialMusicAssetId }: SceneEditorProps) {
  const projectDefaultBackgroundColor = useEditorStore(
    (s) => s.projectConfig?.defaultBackgroundColor ?? '#000000'
  )
  const [data, setData]     = useState<SceneDataResponse | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [section, setSection] = useState<Section>('layers')

  // Properties state
  const [isEnd, setIsEnd]         = useState(initialIsEnd)
  const [autoContinue, setAutoContinue] = useState(initialAutoContinue)
  const [bgColor, setBgColor]     = useState(initialBg ?? projectDefaultBackgroundColor)
  const [musicAssetId, setMusicAssetId] = useState<string | null>(initialMusicAssetId)
  const [previewJob, setPreviewJob] = useState<PreviewJobStatus | null>(null)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    setIsEnd(initialIsEnd)
    setAutoContinue(initialAutoContinue)
    setBgColor(initialBg ?? projectDefaultBackgroundColor)
    setMusicAssetId(initialMusicAssetId)
  }, [initialIsEnd, initialAutoContinue, initialBg, projectDefaultBackgroundColor, initialMusicAssetId, nodeId])

  async function handlePreview() {
    setPreviewing(true)
    try {
      const job = await startScenePreview(nodeId)
      setPreviewJob(job)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([getSceneData(nodeId), listAssets({ mediaType: 'video' })])
      .then(([d, a]) => { setData(d); setAssets(a) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [nodeId])

  async function withSave<T>(fn: () => Promise<T>) {
    setSaving(true); setError(null)
    try { return await fn() }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Save failed'); return null }
    finally { setSaving(false) }
  }

  // ── Video layers ─────────────────────────────────────────────────────────

  function toLayerReq(vl: VideoLayerData): VideoLayerRequest {
    return { assetId: vl.assetId, startAt: vl.startAt, freezeLastFrame: vl.freezeLastFrame }
  }

  async function addVideoLayer(asset: Asset) {
    if (!data) return
    const newLayers: VideoLayerRequest[] = [
      ...data.videoLayers.map(toLayerReq),
      { assetId: asset.id, startAt: 0, freezeLastFrame: false },
    ]
    const result = await withSave(() => saveVideoLayers(nodeId, newLayers))
    if (result) setData(result)
  }

  async function removeVideoLayer(layerId: number) {
    if (!data) return
    const newLayers = data.videoLayers.filter(vl => vl.id !== layerId).map(toLayerReq)
    const result = await withSave(() => saveVideoLayers(nodeId, newLayers))
    if (result) setData(result)
  }

  async function moveVideoLayer(layerId: number, dir: -1 | 1) {
    if (!data) return
    const layers = [...data.videoLayers]
    const idx = layers.findIndex(l => l.id === layerId)
    if (idx + dir < 0 || idx + dir >= layers.length) return
    ;[layers[idx], layers[idx + dir]] = [layers[idx + dir], layers[idx]]
    const result = await withSave(() => saveVideoLayers(nodeId, layers.map(toLayerReq)))
    if (result) setData(result)
  }

  async function updateLayerStartAt(layerId: number, startAt: number) {
    if (!data) return
    const newLayers = data.videoLayers.map(vl =>
      ({ ...toLayerReq(vl), ...(vl.id === layerId ? { startAt } : {}) })
    )
    const result = await withSave(() => saveVideoLayers(nodeId, newLayers))
    if (result) setData(result)
  }

  async function updateLayerFreeze(layerId: number, freezeLastFrame: boolean) {
    if (!data) return
    const newLayers = data.videoLayers.map(vl =>
      ({ ...toLayerReq(vl), ...(vl.id === layerId ? { freezeLastFrame } : {}) })
    )
    const result = await withSave(() => saveVideoLayers(nodeId, newLayers))
    if (result) setData(result)
  }

  // ── Audio tracks ──────────────────────────────────────────────────────────

  const [audioAssets, setAudioAssets] = useState<Asset[]>([])
  useEffect(() => {
    listAssets({ mediaType: 'audio' }).then(setAudioAssets).catch(() => {})
  }, [])

  async function addAudioTrack(asset: Asset) {
    if (!data) return
    const newTracks: AudioTrackRequest[] = [
      ...data.audioTracks.map(t => ({ assetId: t.assetId, startAt: t.startAt })),
      { assetId: asset.id, startAt: 0 },
    ]
    const result = await withSave(() => saveAudioTracks(nodeId, newTracks))
    if (result) setData(result)
  }

  async function removeAudioTrack(trackId: number) {
    if (!data) return
    const newTracks = data.audioTracks
      .filter(t => t.id !== trackId)
      .map(t => ({ assetId: t.assetId, startAt: t.startAt }))
    const result = await withSave(() => saveAudioTracks(nodeId, newTracks))
    if (result) setData(result)
  }

  async function moveAudioTrack(trackId: number, dir: -1 | 1) {
    if (!data) return
    const tracks = [...data.audioTracks]
    const idx = tracks.findIndex(t => t.id === trackId)
    if (idx + dir < 0 || idx + dir >= tracks.length) return
    ;[tracks[idx], tracks[idx + dir]] = [tracks[idx + dir], tracks[idx]]
    const result = await withSave(() => saveAudioTracks(nodeId, tracks.map(t => ({ assetId: t.assetId, startAt: t.startAt }))))
    if (result) setData(result)
  }

  // ── Decisions ─────────────────────────────────────────────────────────────

  const [newDecisionKey, setNewDecisionKey] = useState('')

  async function addDecision() {
    if (!data || !newDecisionKey.trim()) return
    const existing = data.decisions
    const newDecisions: DecisionItemRequest[] = [
      ...existing.map(d => ({ decisionKey: d.decisionKey, isDefault: d.isDefault, decisionOrder: d.decisionOrder })),
      { decisionKey: newDecisionKey.trim(), isDefault: existing.length === 0, decisionOrder: existing.length },
    ]
    const result = await withSave(() => saveDecisions(nodeId, newDecisions))
    if (result) { setData(result); setNewDecisionKey('') }
  }

  async function removeDecision(decId: number) {
    if (!data) return
    const filtered = data.decisions.filter(d => d.id !== decId)
    let decisions = filtered.map((d, i) => ({ decisionKey: d.decisionKey, isDefault: d.isDefault, decisionOrder: i }))
    if (decisions.length > 0 && !decisions.some(d => d.isDefault)) decisions[0].isDefault = true
    const result = await withSave(() => saveDecisions(nodeId, decisions))
    if (result) setData(result)
  }

  async function setDefaultDecision(decisionKey: string) {
    if (!data) return
    const decisions = data.decisions.map(d => ({ decisionKey: d.decisionKey, isDefault: d.decisionKey === decisionKey, decisionOrder: d.decisionOrder }))
    const result = await withSave(() => saveDecisions(nodeId, decisions))
    if (result) setData(result)
  }

  // ── Properties ────────────────────────────────────────────────────────────

  async function saveProperties() {
    const payload: Record<string, unknown> = { isEnd, autoContinue, backgroundColor: bgColor }
    if (musicAssetId) {
      payload.musicAssetId = musicAssetId
    } else {
      payload.clearMusicAsset = true
    }
    await withSave(() => updateNode(nodeId, payload))
  }

  if (loading) return <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">Loading…</div>

  const SECTIONS: { id: Section; label: string }[] = [
    { id: 'layers', label: 'Layers' },
    { id: 'audio', label: 'Audio' },
    { id: 'decisions', label: 'Decisions' },
    { id: 'props', label: 'Props' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Error */}
      {error && <div className="mx-3 my-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}

      {previewJob && (
        <PreviewModal
          initialJob={previewJob}
          title={`Scene preview`}
          onClose={() => setPreviewJob(null)}
        />
      )}

      {/* Computed duration */}
      {data?.computedDuration != null && (
        <div className="text-muted-foreground border-b border-border/50 flex items-center justify-between" style={{ padding: '14px 24px', fontSize: 14 }}>
          <span>Duration: <span className="text-foreground font-medium">{data.computedDuration.toFixed(2)}s</span>
          {saving && <span className="ml-2">Saving…</span>}</span>
          <button
            onClick={handlePreview}
            disabled={previewing}
            className="rounded-md bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-50 transition-colors border border-primary/30"
            style={{ padding: '7px 14px', fontSize: 14 }}
          >
            {previewing ? '…' : '▶ Preview'}
          </button>
        </div>
      )}

      {/* Sub-section tabs */}
      <div className="flex border-b border-border shrink-0">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={[
              'flex-1 font-medium transition-colors',
              section === s.id ? 'text-foreground border-b-2 border-primary -mb-px' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
            style={{ padding: '14px 0', fontSize: 14 }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 20, gap: 16 }}>
        {/* ── Video Layers ── */}
        {section === 'layers' && (
          <>
            {data?.videoLayers.map((vl, i) => (
              <VideoLayerRow
                key={vl.id} layer={vl} index={i} total={data.videoLayers.length}
                onRemove={() => removeVideoLayer(vl.id)}
                onMoveUp={() => moveVideoLayer(vl.id, -1)}
                onMoveDown={() => moveVideoLayer(vl.id, 1)}
                onStartAtChange={v => updateLayerStartAt(vl.id, v)}
                onFreezeChange={v => updateLayerFreeze(vl.id, v)}
              />
            ))}
            {!data?.videoLayers.length && (
              <p className="text-sm text-muted-foreground text-center py-4">No video layers. Add from the list below.</p>
            )}
            <AssetPicker label="Add video layer" assets={assets} onPick={addVideoLayer} />
          </>
        )}

        {/* ── Audio Tracks ── */}
        {section === 'audio' && (
          <>
            {data?.audioTracks.map((t, i) => (
              <AudioTrackRow
                key={t.id} track={t} index={i} total={data.audioTracks.length}
                onRemove={() => removeAudioTrack(t.id)}
                onMoveUp={() => moveAudioTrack(t.id, -1)}
                onMoveDown={() => moveAudioTrack(t.id, 1)}
              />
            ))}
            {!data?.audioTracks.length && (
              <p className="text-sm text-muted-foreground text-center py-4">No audio tracks.</p>
            )}
            <AssetPicker label="Add audio track" assets={audioAssets} onPick={addAudioTrack} />
          </>
        )}

        {/* ── Decisions ── */}
        {section === 'decisions' && (
          <>
            {data?.decisions.map(d => (
              <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/50">
                <button
                  onClick={() => setDefaultDecision(d.decisionKey)}
                  title="Set as default"
                  className={['w-3 h-3 rounded-full border shrink-0 transition-colors',
                    d.isDefault ? 'bg-amber-400 border-amber-400' : 'border-muted-foreground hover:border-amber-400',
                  ].join(' ')}
                />
                <span className="flex-1 text-sm text-foreground truncate">{d.decisionKey}</span>
                {d.isDefault && <span className="text-xs text-amber-400">default</span>}
                <button onClick={() => removeDecision(d.id)} className="text-muted-foreground hover:text-red-400 text-sm leading-none">×</button>
              </div>
            ))}
            {!data?.decisions.length && (
              <p className="text-sm text-muted-foreground text-center py-2">No decisions defined. Scene uses default CONTINUE.</p>
            )}
            <div className="flex gap-2 mt-1">
              <input
                value={newDecisionKey}
                onChange={e => setNewDecisionKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDecision()}
                placeholder="decision key…"
                className="input-base text-xs py-1 flex-1"
              />
              <button
                onClick={addDecision}
                disabled={!newDecisionKey.trim()}
                className="rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
                style={{ padding: '8px 16px', fontSize: 14 }}
              >
                Add
              </button>
            </div>
          </>
        )}

        {/* ── Props ── */}
        {section === 'props' && (
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isEnd}
                onChange={e => setIsEnd(e.target.checked)}
                className="w-4 h-4 accent-red-400"
              />
              <div>
                <span className="font-medium text-foreground" style={{ fontSize: 14 }}>End node</span>
                <p className="text-muted-foreground" style={{ fontSize: 13 }}>The game ends when this scene finishes.</p>
              </div>
            </label>
            {!data?.decisions.length && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoContinue}
                  onChange={e => setAutoContinue(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <div>
                  <span className="font-medium text-foreground" style={{ fontSize: 14 }}>Auto-continue</span>
                  <p className="text-muted-foreground" style={{ fontSize: 13 }}>Next scene plays immediately when video ends, with no button shown.</p>
                </div>
              </label>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-muted-foreground" style={{ fontSize: 14 }}>Background color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={e => setBgColor(e.target.value)}
                  className="w-10 h-8 rounded border border-border bg-transparent cursor-pointer"
                />
                <span className="text-sm text-muted-foreground font-mono">{bgColor}</span>
              </div>
            </div>
            {/* Background Music */}
            <div className="flex flex-col gap-1.5">
              <label className="text-muted-foreground" style={{ fontSize: 14 }}>Background music</label>
              {musicAssetId ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/50">
                  <span className="text-sm text-foreground truncate flex-1">
                    {audioAssets.find(a => a.id === musicAssetId)?.fileName || musicAssetId}
                  </span>
                  <button
                    onClick={() => setMusicAssetId(null)}
                    className="text-muted-foreground hover:text-red-400 text-sm leading-none"
                  >×</button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None — current music keeps playing.</p>
              )}
              <MusicPicker
                assets={audioAssets}
                onPick={(a) => setMusicAssetId(a.id)}
              />
            </div>

            <button
              onClick={saveProperties}
              disabled={saving}
              className="rounded-lg bg-primary text-primary-foreground disabled:opacity-40 font-medium"
              style={{ padding: '10px 20px', fontSize: 14 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VideoLayerRow({ layer, index, total, onRemove, onMoveUp, onMoveDown, onStartAtChange, onFreezeChange }: {
  layer: VideoLayerData; index: number; total: number
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void
  onStartAtChange: (v: number) => void
  onFreezeChange: (v: boolean) => void
}) {
  const [localStartAt, setLocalStartAt] = useState(String(layer.startAt))

  return (
    <div className={['rounded-lg border p-2.5 flex flex-col gap-2',
      layer.alphaError ? 'border-red-500/60 bg-red-500/5' : 'border-border/50 bg-muted/40',
    ].join(' ')}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-5 shrink-0">#{index + 1}</span>
        {layer.hasAlpha && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">α</span>
        )}
        <span className="flex-1 text-sm text-foreground truncate">{layer.assetFileName}</span>
        <div className="flex items-center gap-0.5">
          <button onClick={onMoveUp}  disabled={index === 0}          className="w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs">↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs">↓</button>
          <button onClick={onRemove} className="w-5 h-5 text-muted-foreground hover:text-red-400 flex items-center justify-center">×</button>
        </div>
      </div>
      {layer.alphaError && (
        <p className="text-[10px] text-red-400">Non-bottom layer must have alpha channel</p>
      )}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">start-at</label>
        <input
          type="number" min="0" step="0.1"
          value={localStartAt}
          onChange={e => setLocalStartAt(e.target.value)}
          onBlur={() => { const v = parseFloat(localStartAt); if (!isNaN(v) && v >= 0) onStartAtChange(v) }}
          className="input-base text-xs py-0.5 w-20"
        />
        <span className="text-[10px] text-muted-foreground">s</span>
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

function AudioTrackRow({ track, index, total, onRemove, onMoveUp, onMoveDown }: {
  track: AudioTrackData; index: number; total: number
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/40 p-2.5 flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-5 shrink-0">#{index + 1}</span>
      <span className="flex-1 text-sm text-foreground truncate">{track.assetFileName}</span>
      {track.duration != null && <span className="text-xs text-muted-foreground">{track.duration.toFixed(1)}s</span>}
      <div className="flex items-center gap-0.5">
        <button onClick={onMoveUp}   disabled={index === 0}          className="w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs">↑</button>
        <button onClick={onMoveDown} disabled={index === total - 1}  className="w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs">↓</button>
        <button onClick={onRemove} className="w-5 h-5 text-muted-foreground hover:text-red-400 flex items-center justify-center">×</button>
      </div>
    </div>
  )
}

function MusicPicker({ assets, onPick }: { assets: Asset[]; onPick: (a: Asset) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  if (!assets.length) return <p className="text-sm text-muted-foreground text-center py-1">No audio assets scanned.</p>

  const filtered = search
    ? assets.filter(a => a.fileName.toLowerCase().includes(search.toLowerCase()))
    : assets

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-sm text-primary hover:underline text-left font-medium"
      >
        {open ? '▲' : '▼'} Select music
      </button>
      {open && (
        <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-muted/20">
          <div className="p-2 border-b border-border/50">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search audio…"
              className="input-base text-sm py-1.5 w-full"
              autoFocus
            />
          </div>
          <div className="flex flex-col max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">No matching audio</p>
            ) : (
              filtered.map(a => (
                <button
                  key={a.id}
                  onClick={() => { onPick(a); setOpen(false); setSearch('') }}
                  className="text-left px-4 py-2 text-sm text-foreground hover:bg-accent border-b border-border/30 last:border-0 flex items-center gap-3"
                >
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
