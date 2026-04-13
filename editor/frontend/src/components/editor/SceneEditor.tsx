import { useState, useEffect, type KeyboardEvent } from 'react'
import type { AmbientAction, AmbientConfig, AmbientConfigRequest, SceneDataResponse, VideoLayerData, AudioTrackData, Asset } from '@/types'
import {
  getSceneData, saveVideoLayers, saveAudioTracks, saveDecisions,
  type VideoLayerRequest, type AudioTrackRequest, type DecisionItemRequest,
} from '@/api/nodeEditor'
import { listAssets } from '@/api/assets'
import { updateNode, type UpdateNodePayload } from '@/api/graph'
import { recordHistoryEntry } from '@/history'
import { startScenePreview, type PreviewJobStatus } from '@/api/preview'
import { useEditorStore } from '@/store'
import PreviewModal from './PreviewModal'
import SpelInput from './SpelInput'

interface SceneEditorProps {
  nodeId: string
  isEnd: boolean
  autoContinue: boolean
  loopVideo: boolean
  backgroundColor: string | null
  musicAssetId: string | null
  ambient: AmbientConfig | null
  hideDecisionButtons: boolean | null
  showDecisionInputIndicator: boolean | null
  onNodeUpdated?: () => void
}

interface ScenePropertySnapshot {
  isEnd: boolean
  autoContinue: boolean
  loopVideo: boolean
  backgroundColor: string | null
  musicAssetId: string | null
  ambientAction: AmbientAction
  ambientZoneId: string
  useAmbientVolumeOverride: boolean
  ambientVolumeOverride: string
  useAmbientFadeOverride: boolean
  ambientFadeMsOverride: string
  useSceneDecisionInputMode: boolean
  hideDecisionButtons: boolean
  showDecisionInputIndicator: boolean
}

type Section = 'layers' | 'audio' | 'decisions' | 'props'

const DEFAULT_DECISION_CONDITION_EXPRESSION = "#state['FLAG'] == 1"

function formatKeyboardKeyLabel(key: string | null | undefined): string {
  if (!key) return 'Assign key'
  if (key === ' ') return 'Space'
  return key
}

function normalizeCapturedKeyboardKey(key: string): string | null {
  if (!key || key === 'Unidentified') return null
  if (key === ' ') return 'Space'
  if (key === 'Spacebar') return 'Space'
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(key)) return null
  if (key.length === 1) return key.toUpperCase()
  return key
}

function describeDecisionInputMode(hideDecisionButtons: boolean, showDecisionInputIndicator: boolean): string {
  if (!hideDecisionButtons) {
    return 'Decision buttons stay visible in runtime.'
  }
  if (showDecisionInputIndicator) {
    return 'Decision buttons are hidden and the bottom-screen input indicator is shown when hotkeys are available.'
  }
  return 'Decision buttons are hidden and players choose using assigned keyboard keys.'
}

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

function buildScenePropertyPayload(snapshot: ScenePropertySnapshot): UpdateNodePayload {
  const payload: UpdateNodePayload = {
    isEnd: snapshot.isEnd,
    autoContinue: snapshot.autoContinue,
    loopVideo: snapshot.loopVideo,
  }

  if (snapshot.backgroundColor != null) {
    payload.backgroundColor = snapshot.backgroundColor
  } else {
    payload.clearBackgroundColor = true
  }

  payload.ambient = buildAmbientRequest(
    snapshot.ambientAction,
    snapshot.ambientZoneId,
    snapshot.useAmbientVolumeOverride,
    snapshot.ambientVolumeOverride,
    snapshot.useAmbientFadeOverride,
    snapshot.ambientFadeMsOverride,
  )

  if (snapshot.musicAssetId) {
    payload.musicAssetId = snapshot.musicAssetId
  } else {
    payload.clearMusicAsset = true
  }

  if (snapshot.useSceneDecisionInputMode) {
    payload.hideDecisionButtons = snapshot.hideDecisionButtons
    payload.showDecisionInputIndicator = snapshot.hideDecisionButtons && snapshot.showDecisionInputIndicator
  } else {
    payload.clearDecisionInputModeOverride = true
  }

  return payload
}

export default function SceneEditor({ nodeId, isEnd: initialIsEnd, autoContinue: initialAutoContinue, loopVideo: initialLoopVideo, backgroundColor: initialBg, musicAssetId: initialMusicAssetId, ambient: initialAmbient, hideDecisionButtons: initialHideDecisionButtons, showDecisionInputIndicator: initialShowDecisionInputIndicator, onNodeUpdated }: SceneEditorProps) {
  const projectConfig = useEditorStore((s) => s.projectConfig)
  const ambientZones = projectConfig?.ambientZones ?? []
  const projectDefaultBackgroundColor = projectConfig?.defaultBackgroundColor ?? '#000000'
  const projectHideDecisionButtons = projectConfig?.hideDecisionButtons ?? false
  const projectShowDecisionInputIndicator = projectHideDecisionButtons && (projectConfig?.showDecisionInputIndicator ?? false)
  const [data, setData]     = useState<SceneDataResponse | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [section, setSection] = useState<Section>('layers')

  // Properties state
  const [isEnd, setIsEnd]         = useState(initialIsEnd)
  const [autoContinue, setAutoContinue] = useState(initialAutoContinue)
  const [loopVideo, setLoopVideo] = useState(initialLoopVideo)
  const [useCustomBackgroundColor, setUseCustomBackgroundColor] = useState(initialBg != null)
  const [bgColor, setBgColor]     = useState(initialBg ?? projectDefaultBackgroundColor)
  const [musicAssetId, setMusicAssetId] = useState<string | null>(initialMusicAssetId)
  const [ambientAction, setAmbientAction] = useState<AmbientAction>(normalizeAmbientAction(initialAmbient?.action))
  const [ambientZoneId, setAmbientZoneId] = useState(initialAmbient?.zoneId ?? '')
  const [useAmbientVolumeOverride, setUseAmbientVolumeOverride] = useState(initialAmbient?.volumeOverride != null)
  const [ambientVolumeOverride, setAmbientVolumeOverride] = useState(initialAmbient?.volumeOverride != null ? String(initialAmbient.volumeOverride) : '1')
  const [useAmbientFadeOverride, setUseAmbientFadeOverride] = useState(initialAmbient?.fadeMsOverride != null)
  const [ambientFadeMsOverride, setAmbientFadeMsOverride] = useState(initialAmbient?.fadeMsOverride != null ? String(initialAmbient.fadeMsOverride) : '0')
  const [useSceneDecisionInputMode, setUseSceneDecisionInputMode] = useState(
    initialHideDecisionButtons != null || initialShowDecisionInputIndicator != null
  )
  const [hideDecisionButtons, setHideDecisionButtons] = useState(
    initialHideDecisionButtons ?? projectHideDecisionButtons
  )
  const [showDecisionInputIndicator, setShowDecisionInputIndicator] = useState(
    (initialHideDecisionButtons ?? projectHideDecisionButtons)
      && (initialShowDecisionInputIndicator ?? projectShowDecisionInputIndicator)
  )
  const [previewJob, setPreviewJob] = useState<PreviewJobStatus | null>(null)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    setIsEnd(initialIsEnd)
    setAutoContinue(initialAutoContinue)
    setLoopVideo(initialLoopVideo)
    setUseCustomBackgroundColor(initialBg != null)
    setBgColor(initialBg ?? projectDefaultBackgroundColor)
    setMusicAssetId(initialMusicAssetId)
    setAmbientAction(normalizeAmbientAction(initialAmbient?.action))
    setAmbientZoneId(initialAmbient?.zoneId ?? '')
    setUseAmbientVolumeOverride(initialAmbient?.volumeOverride != null)
    setAmbientVolumeOverride(initialAmbient?.volumeOverride != null ? String(initialAmbient.volumeOverride) : '1')
    setUseAmbientFadeOverride(initialAmbient?.fadeMsOverride != null)
    setAmbientFadeMsOverride(initialAmbient?.fadeMsOverride != null ? String(initialAmbient.fadeMsOverride) : '0')
    setUseSceneDecisionInputMode(initialHideDecisionButtons != null || initialShowDecisionInputIndicator != null)
    setHideDecisionButtons(initialHideDecisionButtons ?? projectHideDecisionButtons)
    setShowDecisionInputIndicator(
      (initialHideDecisionButtons ?? projectHideDecisionButtons)
        && (initialShowDecisionInputIndicator ?? projectShowDecisionInputIndicator)
    )
  }, [initialIsEnd, initialAutoContinue, initialLoopVideo, initialBg, projectDefaultBackgroundColor, initialMusicAssetId, initialAmbient?.action, initialAmbient?.zoneId, initialAmbient?.volumeOverride, initialAmbient?.fadeMsOverride, initialHideDecisionButtons, initialShowDecisionInputIndicator, projectHideDecisionButtons, projectShowDecisionInputIndicator, nodeId])

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

  function updateDecisionConditionDraft(decisionId: number, value: string) {
    setDecisionConditionDrafts((prev) => ({ ...prev, [decisionId]: value }))
  }

  async function setDecisionConditionExpression(decisionId: number, conditionExpression: string | null) {
    if (!data) return
    const decisions = data.decisions.map(d => (
      d.id === decisionId ? { ...toDecisionReq(d), conditionExpression } : toDecisionReq(d)
    ))
    const result = await withSave(() => saveDecisions(nodeId, decisions))
    if (result) setData(result)
  }

  async function toggleDecisionConditional(decisionId: number, enabled: boolean) {
    if (!enabled) {
      setDecisionConditionDrafts((prev) => ({ ...prev, [decisionId]: '' }))
      await setDecisionConditionExpression(decisionId, null)
      return
    }
    const nextExpression = (decisionConditionDrafts[decisionId] ?? '').trim() || DEFAULT_DECISION_CONDITION_EXPRESSION
    setDecisionConditionDrafts((prev) => ({ ...prev, [decisionId]: nextExpression }))
    await setDecisionConditionExpression(decisionId, nextExpression)
  }

  async function saveDecisionCondition(decisionId: number) {
    const nextExpression = (decisionConditionDrafts[decisionId] ?? '').trim()
    await setDecisionConditionExpression(decisionId, nextExpression || null)
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

  async function refreshNodeSelection() {
    await Promise.resolve(onNodeUpdated?.())
    useEditorStore.getState().setSelectedNodeId(nodeId)
  }

  // ── Video layers ─────────────────────────────────────────────────────────

  function toLayerReq(vl: VideoLayerData): VideoLayerRequest {
    return {
      assetId: vl.assetId,
      startAt: vl.startAt,
      startAtFrames: vl.startAtFrames,
      freezeLastFrame: vl.freezeLastFrame,
      loopLayer: vl.loopLayer,
    }
  }

  async function addVideoLayer(asset: Asset) {
    if (!data) return
    const newLayers: VideoLayerRequest[] = [
      ...data.videoLayers.map(toLayerReq),
      { assetId: asset.id, startAt: 0, startAtFrames: null, freezeLastFrame: false, loopLayer: false },
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

  async function updateLayerStartAtFrames(layerId: number, startAtFrames: number | null) {
    if (!data) return
    const newLayers = data.videoLayers.map(vl =>
      ({ ...toLayerReq(vl), ...(vl.id === layerId ? { startAtFrames } : {}) })
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

  async function updateLayerLoop(layerId: number, loopLayer: boolean) {
    if (!data) return
    const newLayers = data.videoLayers.map(vl =>
      ({ ...toLayerReq(vl), ...(vl.id === layerId ? { loopLayer } : {}) })
    )
    const result = await withSave(() => saveVideoLayers(nodeId, newLayers))
    if (result) setData(result)
  }

  // ── Audio tracks ──────────────────────────────────────────────────────────

  const [audioAssets, setAudioAssets] = useState<Asset[]>([])
  useEffect(() => {
    listAssets({ mediaType: 'audio' }).then(setAudioAssets).catch(() => {})
  }, [])

  function toAudioReq(t: AudioTrackData): AudioTrackRequest {
    return { assetId: t.assetId, startAt: t.startAt, startAtFrames: t.startAtFrames }
  }

  async function addAudioTrack(asset: Asset) {
    if (!data) return
    const newTracks: AudioTrackRequest[] = [
      ...data.audioTracks.map(toAudioReq),
      { assetId: asset.id, startAt: 0, startAtFrames: null },
    ]
    const result = await withSave(() => saveAudioTracks(nodeId, newTracks))
    if (result) setData(result)
  }

  async function removeAudioTrack(trackId: number) {
    if (!data) return
    const newTracks = data.audioTracks
      .filter(t => t.id !== trackId)
      .map(toAudioReq)
    const result = await withSave(() => saveAudioTracks(nodeId, newTracks))
    if (result) setData(result)
  }

  async function moveAudioTrack(trackId: number, dir: -1 | 1) {
    if (!data) return
    const tracks = [...data.audioTracks]
    const idx = tracks.findIndex(t => t.id === trackId)
    if (idx + dir < 0 || idx + dir >= tracks.length) return
    ;[tracks[idx], tracks[idx + dir]] = [tracks[idx + dir], tracks[idx]]
    const result = await withSave(() => saveAudioTracks(nodeId, tracks.map(toAudioReq)))
    if (result) setData(result)
  }

  async function updateAudioStartAt(trackId: number, startAt: number) {
    if (!data) return
    const newTracks = data.audioTracks.map(t =>
      ({ ...toAudioReq(t), ...(t.id === trackId ? { startAt } : {}) })
    )
    const result = await withSave(() => saveAudioTracks(nodeId, newTracks))
    if (result) setData(result)
  }

  async function updateAudioStartAtFrames(trackId: number, startAtFrames: number | null) {
    if (!data) return
    const newTracks = data.audioTracks.map(t =>
      ({ ...toAudioReq(t), ...(t.id === trackId ? { startAtFrames } : {}) })
    )
    const result = await withSave(() => saveAudioTracks(nodeId, newTracks))
    if (result) setData(result)
  }

  // ── Decisions ─────────────────────────────────────────────────────────────

  const [newDecisionKey, setNewDecisionKey] = useState('')
  const [capturingDecisionId, setCapturingDecisionId] = useState<number | null>(null)
  const [decisionConditionDrafts, setDecisionConditionDrafts] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!data) return
    setDecisionConditionDrafts(
      Object.fromEntries(data.decisions.map((d) => [d.id, d.conditionExpression ?? '']))
    )
  }, [data])

  function toDecisionReq(d: SceneDataResponse['decisions'][number]): DecisionItemRequest {
    return {
      decisionKey: d.decisionKey,
      isDefault: d.isDefault,
      decisionOrder: d.decisionOrder,
      keyboardKey: d.keyboardKey ?? null,
      conditionExpression: d.conditionExpression ?? null,
    }
  }

  async function addDecision() {
    if (!data || !newDecisionKey.trim()) return
    const existing = data.decisions
    const newDecisions: DecisionItemRequest[] = [
      ...existing.map(toDecisionReq),
      {
        decisionKey: newDecisionKey.trim(),
        isDefault: existing.length === 0,
        decisionOrder: existing.length,
        keyboardKey: null,
        conditionExpression: null,
      },
    ]
    const result = await withSave(() => saveDecisions(nodeId, newDecisions))
    if (result) { setData(result); setNewDecisionKey('') }
  }

  async function removeDecision(decId: number) {
    if (!data) return
    const filtered = data.decisions.filter(d => d.id !== decId)
    const decisions = filtered.map((d, i) => ({ ...toDecisionReq(d), decisionOrder: i }))
    if (decisions.length > 0 && !decisions.some(d => d.isDefault)) decisions[0].isDefault = true
    const result = await withSave(() => saveDecisions(nodeId, decisions))
    if (result) {
      setData(result)
      if (capturingDecisionId === decId) setCapturingDecisionId(null)
    }
  }

  async function setDefaultDecision(decisionKey: string) {
    if (!data) return
    const decisions = data.decisions.map(d => ({ ...toDecisionReq(d), isDefault: d.decisionKey === decisionKey }))
    const result = await withSave(() => saveDecisions(nodeId, decisions))
    if (result) setData(result)
  }

  async function setDecisionKeyboardKey(decisionId: number, keyboardKey: string | null) {
    if (!data) return
    const decisions = data.decisions.map(d => (
      d.id === decisionId ? { ...toDecisionReq(d), keyboardKey } : toDecisionReq(d)
    ))
    const result = await withSave(() => saveDecisions(nodeId, decisions))
    if (result) {
      setData(result)
      setCapturingDecisionId(null)
    }
  }

  async function handleDecisionKeyCapture(decisionId: number, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.repeat) return
    if (event.key === 'Tab') return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') {
      setCapturingDecisionId(null)
      return
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      await setDecisionKeyboardKey(decisionId, null)
      return
    }
    const keyboardKey = normalizeCapturedKeyboardKey(event.key)
    if (!keyboardKey) return
    await setDecisionKeyboardKey(decisionId, keyboardKey)
  }

  // ── Properties ────────────────────────────────────────────────────────────

  async function saveProperties() {
    const previousSnapshot: ScenePropertySnapshot = {
      isEnd: initialIsEnd,
      autoContinue: initialAutoContinue,
      loopVideo: initialLoopVideo,
      backgroundColor: initialBg ?? null,
      musicAssetId: initialMusicAssetId,
      ambientAction: normalizeAmbientAction(initialAmbient?.action),
      ambientZoneId: initialAmbient?.zoneId ?? '',
      useAmbientVolumeOverride: initialAmbient?.volumeOverride != null,
      ambientVolumeOverride: initialAmbient?.volumeOverride != null ? String(initialAmbient.volumeOverride) : '1',
      useAmbientFadeOverride: initialAmbient?.fadeMsOverride != null,
      ambientFadeMsOverride: initialAmbient?.fadeMsOverride != null ? String(initialAmbient.fadeMsOverride) : '0',
      useSceneDecisionInputMode: initialHideDecisionButtons != null || initialShowDecisionInputIndicator != null,
      hideDecisionButtons: initialHideDecisionButtons ?? projectHideDecisionButtons,
      showDecisionInputIndicator: (initialHideDecisionButtons ?? projectHideDecisionButtons)
        && (initialShowDecisionInputIndicator ?? projectShowDecisionInputIndicator),
    }
    const nextSnapshot: ScenePropertySnapshot = {
      isEnd,
      autoContinue,
      loopVideo,
      backgroundColor: useCustomBackgroundColor ? bgColor : null,
      musicAssetId,
      ambientAction,
      ambientZoneId,
      useAmbientVolumeOverride,
      ambientVolumeOverride,
      useAmbientFadeOverride,
      ambientFadeMsOverride,
      useSceneDecisionInputMode,
      hideDecisionButtons,
      showDecisionInputIndicator,
    }

    let previousPayload: UpdateNodePayload
    let nextPayload: UpdateNodePayload
    try {
      previousPayload = buildScenePropertyPayload(previousSnapshot)
      nextPayload = buildScenePropertyPayload(nextSnapshot)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ambient settings are invalid')
      return
    }

    if (JSON.stringify(previousPayload) === JSON.stringify(nextPayload)) {
      return
    }

    const result = await withSave(() => updateNode(nodeId, nextPayload))
    if (result) {
      await refreshNodeSelection()
      recordHistoryEntry({
        label: 'Update Scene Properties',
        undo: async () => {
          await updateNode(nodeId, previousPayload)
          await refreshNodeSelection()
        },
        redo: async () => {
          await updateNode(nodeId, nextPayload)
          await refreshNodeSelection()
        },
      })
    }
  }

  if (loading) return <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">Loading…</div>

  const SECTIONS: { id: Section; label: string }[] = [
    { id: 'layers', label: 'Layers' },
    { id: 'audio', label: 'Audio' },
    { id: 'decisions', label: 'Decisions' },
    { id: 'props', label: 'Props' },
  ]
  const selectedAmbientZone = ambientZones.find((zone) => zone.id === ambientZoneId)
  const ambientOverridesEnabled = ambientAction !== 'stop'

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
                onStartAtFramesChange={v => updateLayerStartAtFrames(vl.id, v)}
                onFreezeChange={v => updateLayerFreeze(vl.id, v)}
                onLoopChange={v => updateLayerLoop(vl.id, v)}
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
                onStartAtChange={v => updateAudioStartAt(t.id, v)}
                onStartAtFramesChange={v => updateAudioStartAtFrames(t.id, v)}
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
              <div key={d.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 border border-border/50">
                <button
                  onClick={() => setDefaultDecision(d.decisionKey)}
                  title="Set as default"
                  className={['w-3 h-3 rounded-full border shrink-0 transition-colors mt-1.5',
                    d.isDefault ? 'bg-amber-400 border-amber-400' : 'border-muted-foreground hover:border-amber-400',
                  ].join(' ')}
                />
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <span className="text-sm text-foreground truncate">{d.decisionKey}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setCapturingDecisionId(d.id)}
                      onKeyDown={(event) => handleDecisionKeyCapture(d.id, event)}
                      onBlur={() => setCapturingDecisionId((prev) => prev === d.id ? null : prev)}
                      className={[
                        'rounded-md border text-xs px-2.5 py-1.5 transition-colors',
                        capturingDecisionId === d.id
                          ? 'border-primary text-primary bg-primary/10'
                          : 'border-border/70 text-muted-foreground hover:text-foreground hover:border-border',
                      ].join(' ')}
                    >
                      {capturingDecisionId === d.id ? 'Press key…' : formatKeyboardKeyLabel(d.keyboardKey)}
                    </button>
                    {d.keyboardKey && (
                      <button
                        type="button"
                        onClick={() => setDecisionKeyboardKey(d.id, null)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear key
                      </button>
                    )}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!d.conditionExpression?.trim()}
                      onChange={e => toggleDecisionConditional(d.id, e.target.checked)}
                      className="w-3.5 h-3.5 accent-primary"
                    />
                    <span className="text-[11px] text-muted-foreground">Conditional decision</span>
                  </label>
                  {!!d.conditionExpression?.trim() && (
                    <SpelInput
                      value={decisionConditionDrafts[d.id] ?? d.conditionExpression ?? ''}
                      onChange={value => updateDecisionConditionDraft(d.id, value)}
                      onBlur={() => saveDecisionCondition(d.id)}
                      mode="boolean"
                      placeholder="#state['SCORE'] > 50"
                    />
                  )}
                </div>
                {d.isDefault && <span className="text-xs text-amber-400">default</span>}
                <button onClick={() => removeDecision(d.id)} className="text-muted-foreground hover:text-red-400 text-sm leading-none">×</button>
              </div>
            ))}
            {!data?.decisions.length && (
              <p className="text-sm text-muted-foreground text-center py-2">No decisions defined. Scene uses default CONTINUE.</p>
            )}
            {!!data?.decisions.length && (
              <p className="text-xs text-muted-foreground">Click a key field, then press the keyboard key to assign. Press Delete or Backspace to clear. Conditional expressions can use `#KEY` and `#state['KEY']`.</p>
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
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={loopVideo}
                onChange={e => setLoopVideo(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <div>
                <span className="font-medium text-foreground" style={{ fontSize: 14 }}>Loop video</span>
                <p className="text-muted-foreground" style={{ fontSize: 13 }}>Video replays continuously while waiting for a decision.</p>
              </div>
            </label>
            <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-3">
              <div>
                <span className="font-medium text-foreground" style={{ fontSize: 14 }}>Decision input mode</span>
                <p className="text-muted-foreground" style={{ fontSize: 13 }}>Override the project decision input mode for this scene only.</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSceneDecisionInputMode}
                  onChange={e => setUseSceneDecisionInputMode(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <div>
                  <span className="font-medium text-foreground" style={{ fontSize: 14 }}>Use scene-specific settings</span>
                  <p className="text-muted-foreground" style={{ fontSize: 13 }}>Leave off to inherit the current project default.</p>
                </div>
              </label>
              {!useSceneDecisionInputMode ? (
                <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
                  <span className="text-xs font-medium text-foreground">Using project default</span>
                  <p className="text-xs text-muted-foreground" style={{ marginTop: 4 }}>
                    {describeDecisionInputMode(projectHideDecisionButtons, projectShowDecisionInputIndicator)}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={hideDecisionButtons}
                      onChange={e => {
                        const checked = e.target.checked
                        setHideDecisionButtons(checked)
                        if (!checked) setShowDecisionInputIndicator(false)
                      }}
                      className="w-4 h-4 accent-primary"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">Hide decision buttons at runtime</span>
                      <span className="text-xs text-muted-foreground">Players can still choose using the keyboard keys assigned to each decision.</span>
                    </div>
                  </label>
                  {hideDecisionButtons && (
                    <label className="ml-7 flex items-center gap-3 cursor-pointer rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={showDecisionInputIndicator}
                        onChange={e => setShowDecisionInputIndicator(e.target.checked)}
                        className="w-4 h-4 accent-primary"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">Show bottom-screen input indicator</span>
                        <span className="text-xs text-muted-foreground">Displays a small runtime indicator when hidden keyboard decisions become available.</span>
                      </div>
                    </label>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-muted-foreground" style={{ fontSize: 14 }}>Background color</label>
              <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomBackgroundColor}
                    onChange={e => setUseCustomBackgroundColor(e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <div>
                    <span className="font-medium text-foreground" style={{ fontSize: 14 }}>Use scene-specific background</span>
                    <p className="text-muted-foreground" style={{ fontSize: 13 }}>Leave off to inherit the current project default.</p>
                  </div>
                </label>
                {useCustomBackgroundColor ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={e => setBgColor(e.target.value)}
                      className="w-10 h-8 rounded border border-border bg-transparent cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground font-mono">{bgColor}</span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
                    <span className="text-xs font-medium text-foreground">Using project default</span>
                    <p className="text-xs text-muted-foreground font-mono" style={{ marginTop: 4 }}>{projectDefaultBackgroundColor}</p>
                  </div>
                )}
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

            <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-3">
              <div>
                <span className="font-medium text-foreground" style={{ fontSize: 14 }}>Ambient audio</span>
                <p className="text-muted-foreground" style={{ fontSize: 13 }}>Persistent environmental audio for this scene.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground" style={{ fontSize: 14 }}>Action</label>
                <select
                  value={ambientAction}
                  onChange={e => {
                    const nextAction = e.target.value as AmbientAction
                    setAmbientAction(nextAction)
                    if (nextAction === 'set' && !ambientZoneId && ambientZones[0]) {
                      setAmbientZoneId(ambientZones[0].id)
                    }
                  }}
                  className="input-base text-sm"
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
                <p className="text-xs text-muted-foreground">Stops the active ambient channel when this scene begins.</p>
              )}
              {ambientOverridesEnabled && (
                <div className="flex flex-col gap-3">
                  {ambientAction === 'set' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-muted-foreground" style={{ fontSize: 14 }}>Ambient zone</label>
                        <select
                          value={ambientZoneId}
                          onChange={e => setAmbientZoneId(e.target.value)}
                          className="input-base text-sm"
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
                        <span className="text-xs text-muted-foreground">Adjust the target ambient volume for this scene without forcing a track restart.</span>
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
                        <span className="text-xs text-muted-foreground">Set how quickly this scene adjusts or swaps ambient playback.</span>
                      </div>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-muted-foreground" style={{ fontSize: 14 }}>Volume override</label>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={ambientVolumeOverride}
                        onChange={e => setAmbientVolumeOverride(e.target.value)}
                        disabled={!useAmbientVolumeOverride}
                        className="input-base"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-muted-foreground" style={{ fontSize: 14 }}>Fade override (ms)</label>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={ambientFadeMsOverride}
                        onChange={e => setAmbientFadeMsOverride(e.target.value)}
                        disabled={!useAmbientFadeOverride}
                        className="input-base"
                      />
                    </div>
                  </div>
                </div>
              )}
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

function VideoLayerRow({ layer, index, total, onRemove, onMoveUp, onMoveDown, onStartAtChange, onStartAtFramesChange, onFreezeChange, onLoopChange }: {
  layer: VideoLayerData; index: number; total: number
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void
  onStartAtChange: (v: number) => void
  onStartAtFramesChange: (v: number | null) => void
  onFreezeChange: (v: boolean) => void
  onLoopChange: (v: boolean) => void
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
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={layer.loopLayer}
          onChange={e => onLoopChange(e.target.checked)}
          className="w-3.5 h-3.5 accent-primary"
        />
        <span className="text-[11px] text-muted-foreground">Loop layer until scene end</span>
      </label>
    </div>
  )
}

function AudioTrackRow({ track, index, total, onRemove, onMoveUp, onMoveDown, onStartAtChange, onStartAtFramesChange }: {
  track: AudioTrackData; index: number; total: number
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void
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
        <span className="flex-1 text-sm text-foreground truncate">{track.assetFileName}</span>
        {track.duration != null && <span className="text-xs text-muted-foreground">{track.duration.toFixed(1)}s</span>}
        <div className="flex items-center gap-0.5">
          <button onClick={onMoveUp}   disabled={index === 0}          className="w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs">↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1}  className="w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs">↓</button>
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
