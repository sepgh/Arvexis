import * as graphApi from '@/api/graph'
import {
  getSceneData,
  saveVideoLayers,
  saveAudioTracks,
  saveDecisions,
  getStateData,
  saveAssignments,
  getConditionData,
  saveConditions,
  type VideoLayerRequest,
  type AudioTrackRequest,
  type DecisionItemRequest,
  type AssignmentRequest,
  type ConditionRequest,
} from '@/api/nodeEditor'
import {
  getTransition,
  setTransitionType,
  saveTransitionLayers,
  saveTransitionAudio,
  setTransitionBackgroundColor,
  setTransitionAmbient,
} from '@/api/transition'
import {
  getSubtitles,
  upsertSubtitle,
  getDecisionTranslations,
  upsertDecisionTranslation,
} from '@/api/localization'
import type {
  AmbientConfig,
  AmbientConfigRequest,
  AudioTrackData,
  ConditionData,
  ConditionDataResponse,
  DecisionItemData,
  DecisionTranslation,
  GraphEdge,
  GraphNode,
  SceneDataResponse,
  StateDataResponse,
  SubtitleEntry,
  TransitionAudioData,
  TransitionLayerData,
  TransitionResponse,
  VideoLayerData,
} from '@/types'

export interface GraphNodeSnapshot {
  node: GraphNode
  sceneData: SceneDataResponse | null
  stateData: StateDataResponse | null
  conditionData: ConditionDataResponse | null
  subtitles: SubtitleEntry[]
  decisionTranslations: DecisionTranslation[]
}

export interface GraphEdgeSnapshot {
  edge: GraphEdge
  transition: TransitionResponse | null
}

export interface GraphDeletionSnapshot {
  nodes: GraphNodeSnapshot[]
  edges: GraphEdgeSnapshot[]
}

function buildExplicitAmbientRequest(ambient: AmbientConfig | null | undefined): AmbientConfigRequest {
  if (!ambient) {
    return {
      action: 'inherit',
      clearVolumeOverride: true,
      clearFadeMsOverride: true,
    }
  }
  return toAmbientRequest(ambient)
}

function toAmbientRequest(ambient: AmbientConfig): AmbientConfigRequest {
  const request: AmbientConfigRequest = {
    action: ambient.action,
    clearVolumeOverride: ambient.volumeOverride == null,
    clearFadeMsOverride: ambient.fadeMsOverride == null,
  }

  if (ambient.action === 'set') {
    request.zoneId = ambient.zoneId ?? null
  }
  if (ambient.volumeOverride != null) {
    request.volumeOverride = ambient.volumeOverride
  }
  if (ambient.fadeMsOverride != null) {
    request.fadeMsOverride = ambient.fadeMsOverride
  }

  return request
}

function normalizeDecisionAppearanceConfig(value: GraphNode['decisionAppearanceConfig'] | string | undefined) {
  if (value == null) {
    return undefined
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function buildNodeUpdatePayload(node: GraphNode): graphApi.UpdateNodePayload {
  const payload: graphApi.UpdateNodePayload = {
    name: node.name,
    isEnd: node.isEnd,
    autoContinue: node.autoContinue,
    loopVideo: node.loopVideo,
    posX: node.posX,
    posY: node.posY,
  }

  if (node.backgroundColor != null) {
    payload.backgroundColor = node.backgroundColor
  } else {
    payload.clearBackgroundColor = true
  }
  const decisionAppearanceConfig = normalizeDecisionAppearanceConfig(node.decisionAppearanceConfig)
  if (decisionAppearanceConfig != null) {
    payload.decisionAppearanceConfig = decisionAppearanceConfig
  }
  if (node.musicAssetId != null) {
    payload.musicAssetId = node.musicAssetId
  } else {
    payload.clearMusicAsset = true
  }
  payload.ambient = buildExplicitAmbientRequest(node.ambient)
  if (node.hideDecisionButtons != null) {
    payload.hideDecisionButtons = node.hideDecisionButtons
  }
  if (node.showDecisionInputIndicator != null) {
    payload.showDecisionInputIndicator = node.showDecisionInputIndicator
  }
  if (node.hideDecisionButtons == null && node.showDecisionInputIndicator == null) {
    payload.clearDecisionInputModeOverride = true
  }

  return payload
}

function toVideoLayerRequest(layer: VideoLayerData): VideoLayerRequest {
  return {
    assetId: layer.assetId,
    startAt: layer.startAt,
    startAtFrames: layer.startAtFrames,
    freezeLastFrame: layer.freezeLastFrame,
    loopLayer: layer.loopLayer,
  }
}

function toAudioTrackRequest(track: AudioTrackData): AudioTrackRequest {
  return {
    assetId: track.assetId,
    startAt: track.startAt,
    startAtFrames: track.startAtFrames,
  }
}

function toDecisionRequest(decision: DecisionItemData): DecisionItemRequest {
  return {
    decisionKey: decision.decisionKey,
    isDefault: decision.isDefault,
    decisionOrder: decision.decisionOrder,
    keyboardKey: decision.keyboardKey ?? null,
    conditionExpression: decision.conditionExpression ?? null,
  }
}

function toAssignmentRequest(assignment: StateDataResponse['assignments'][number]): AssignmentRequest {
  return {
    expression: assignment.expression,
  }
}

function toConditionRequest(condition: ConditionData): ConditionRequest {
  return {
    name: condition.name,
    expression: condition.expression,
    isElse: condition.isElse,
  }
}

function toTransitionLayerRequest(layer: TransitionLayerData): VideoLayerRequest {
  return {
    assetId: layer.assetId,
    startAt: layer.startAt,
    startAtFrames: layer.startAtFrames,
    freezeLastFrame: layer.freezeLastFrame,
    loopLayer: false,
  }
}

function toTransitionAudioRequest(track: TransitionAudioData): AudioTrackRequest {
  return {
    assetId: track.assetId,
    startAt: track.startAt,
    startAtFrames: track.startAtFrames,
  }
}

export async function captureNodeSnapshot(node: GraphNode): Promise<GraphNodeSnapshot> {
  if (node.type === 'scene') {
    const [sceneData, subtitles, decisionTranslations] = await Promise.all([
      getSceneData(node.id),
      getSubtitles({ sceneId: node.id }),
      getDecisionTranslations({ sceneId: node.id }),
    ])
    return {
      node,
      sceneData,
      stateData: null,
      conditionData: null,
      subtitles,
      decisionTranslations,
    }
  }

  if (node.type === 'state') {
    return {
      node,
      sceneData: null,
      stateData: await getStateData(node.id),
      conditionData: null,
      subtitles: [],
      decisionTranslations: [],
    }
  }

  return {
    node,
    sceneData: null,
    stateData: null,
    conditionData: await getConditionData(node.id),
    subtitles: [],
    decisionTranslations: [],
  }
}

export async function captureEdgeSnapshot(edge: GraphEdge): Promise<GraphEdgeSnapshot> {
  return {
    edge,
    transition: await getTransition(edge.id),
  }
}

export async function captureGraphDeletionSnapshot(nodes: GraphNode[], allEdges: GraphEdge[]): Promise<GraphDeletionSnapshot> {
  const deletedNodeIds = new Set(nodes.map((node) => node.id))
  const connectedEdges = allEdges.filter(
    (edge) => deletedNodeIds.has(edge.sourceNodeId) || deletedNodeIds.has(edge.targetNodeId),
  )

  const [nodeSnapshots, edgeSnapshots] = await Promise.all([
    Promise.all(nodes.map((node) => captureNodeSnapshot(node))),
    Promise.all(connectedEdges.map((edge) => captureEdgeSnapshot(edge))),
  ])

  return {
    nodes: nodeSnapshots,
    edges: edgeSnapshots,
  }
}

async function restoreNodeBase(snapshot: GraphNodeSnapshot) {
  await graphApi.createNode({
    id: snapshot.node.id,
    name: snapshot.node.name,
    type: snapshot.node.type,
    posX: snapshot.node.posX,
    posY: snapshot.node.posY,
  })
  await graphApi.updateNode(snapshot.node.id, buildNodeUpdatePayload(snapshot.node))
}

async function restoreNodeDetails(snapshot: GraphNodeSnapshot) {
  if (snapshot.sceneData) {
    if (snapshot.sceneData.videoLayers.length > 0) {
      await saveVideoLayers(snapshot.node.id, snapshot.sceneData.videoLayers.map(toVideoLayerRequest))
    }
    if (snapshot.sceneData.audioTracks.length > 0) {
      await saveAudioTracks(snapshot.node.id, snapshot.sceneData.audioTracks.map(toAudioTrackRequest))
    }
    if (snapshot.sceneData.decisions.length > 0) {
      await saveDecisions(snapshot.node.id, snapshot.sceneData.decisions.map(toDecisionRequest))
    }
  }

  if (snapshot.stateData && snapshot.stateData.assignments.length > 0) {
    await saveAssignments(snapshot.node.id, snapshot.stateData.assignments.map(toAssignmentRequest))
  }

  if (snapshot.conditionData && snapshot.conditionData.conditions.length > 0) {
    await saveConditions(snapshot.node.id, snapshot.conditionData.conditions.map(toConditionRequest))
  }
}

async function restoreSceneLocalization(snapshot: GraphNodeSnapshot) {
  for (const subtitle of snapshot.subtitles) {
    await upsertSubtitle({
      id: subtitle.id,
      sceneId: subtitle.sceneId,
      localeCode: subtitle.localeCode,
      startTime: subtitle.startTime,
      endTime: subtitle.endTime,
      text: subtitle.text,
    })
  }

  for (const translation of snapshot.decisionTranslations) {
    await upsertDecisionTranslation({
      id: translation.id,
      decisionKey: translation.decisionKey,
      sceneId: translation.sceneId,
      localeCode: translation.localeCode,
      label: translation.label,
    })
  }
}

export async function restoreEdgeSnapshot(snapshot: GraphEdgeSnapshot) {
  await graphApi.createEdge({
    id: snapshot.edge.id,
    sourceNodeId: snapshot.edge.sourceNodeId,
    targetNodeId: snapshot.edge.targetNodeId,
    sourceDecisionKey: snapshot.edge.sourceDecisionKey,
    sourceConditionOrder: snapshot.edge.sourceConditionOrder,
    sourceConditionName: snapshot.edge.sourceConditionName,
  })

  if (!snapshot.transition || !snapshot.transition.transitionAllowed) {
    return
  }

  if (snapshot.transition.type && snapshot.transition.type !== 'none') {
    await setTransitionType(snapshot.edge.id, snapshot.transition.type, snapshot.transition.duration ?? undefined)
  }
  await setTransitionBackgroundColor(snapshot.edge.id, snapshot.transition.backgroundColor ?? null)
  await setTransitionAmbient(snapshot.edge.id, buildExplicitAmbientRequest(snapshot.transition.ambient))
  if (snapshot.transition.videoLayers.length > 0) {
    await saveTransitionLayers(snapshot.edge.id, snapshot.transition.videoLayers.map(toTransitionLayerRequest))
  }
  if (snapshot.transition.audioTracks.length > 0) {
    await saveTransitionAudio(snapshot.edge.id, snapshot.transition.audioTracks.map(toTransitionAudioRequest))
  }
}

export async function restoreGraphDeletionSnapshot(snapshot: GraphDeletionSnapshot) {
  for (const nodeSnapshot of snapshot.nodes) {
    await restoreNodeBase(nodeSnapshot)
  }

  for (const nodeSnapshot of snapshot.nodes) {
    await restoreNodeDetails(nodeSnapshot)
    if (nodeSnapshot.node.type === 'scene') {
      await restoreSceneLocalization(nodeSnapshot)
    }
  }

  const rootNode = snapshot.nodes.find((nodeSnapshot) => nodeSnapshot.node.isRoot)
  if (rootNode) {
    await graphApi.setRoot(rootNode.node.id)
  }

  for (const edgeSnapshot of snapshot.edges) {
    await restoreEdgeSnapshot(edgeSnapshot)
  }
}
