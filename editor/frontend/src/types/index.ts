// ── Node types ──────────────────────────────────────────────────────────────

export type NodeType = 'scene' | 'state' | 'condition'

/** A single exit/output handle on a node (scene decision key or condition name). */
export interface NodeExit {
  key: string
  label: string
  isDefault: boolean
}

export interface GraphNode {
  id: string
  name: string
  type: NodeType
  isRoot: boolean
  isEnd: boolean
  backgroundColor?: string
  decisionAppearanceConfig?: DecisionAppearanceConfig
  posX: number
  posY: number
  exits: NodeExit[]
}

export interface DecisionAppearanceConfig {
  timing: 'at_timestamp' | 'after_video_ends'
  timestampSeconds?: number
}

// ── Edge / Transition types ──────────────────────────────────────────────────

export type TransitionType =
  | 'none'
  | 'fade_in'
  | 'fade_out'
  | 'crossfade'
  | 'slide_left'
  | 'slide_right'
  | 'wipe'
  | 'dissolve'
  | 'cut'
  | 'video'

export interface GraphEdge {
  id: string
  sourceNodeId: string
  sourceDecisionKey?: string
  sourceConditionOrder?: number
  sourceConditionName?: string
  targetNodeId: string
  transition?: EdgeTransition
}

export interface EdgeTransition {
  type: TransitionType
  duration?: number
  config?: Record<string, unknown>
}

// ── Assets ───────────────────────────────────────────────────────────────────

export interface Asset {
  id: string
  filePath: string
  fileName: string
  directory: string
  mediaType: 'video' | 'audio'
  hasAlpha: boolean
  codec: string | null
  resolution: string | null
  frameRate: number | null
  duration: number | null
  fileSize: number | null
  tags: string[]
}

export interface ScanResult {
  added: number
  updated: number
  removed: number
  skipped: number
  total: number
}

// ── Node editor data ─────────────────────────────────────────────────────────

export interface VideoLayerData {
  id: number
  layerOrder: number
  assetId: string
  assetFileName: string
  hasAlpha: boolean
  duration: number | null
  startAt: number
  alphaError: boolean
  freezeLastFrame: boolean
}

export interface AudioTrackData {
  id: number
  trackOrder: number
  assetId: string
  assetFileName: string
  duration: number | null
  startAt: number
}

export interface DecisionItemData {
  id: number
  decisionKey: string
  isDefault: boolean
  decisionOrder: number
}

export interface SceneDataResponse {
  nodeId: string
  videoLayers: VideoLayerData[]
  audioTracks: AudioTrackData[]
  decisions: DecisionItemData[]
  computedDuration: number | null
}

export interface AssignmentData {
  id: number
  assignmentOrder: number
  expression: string
}

export interface StateDataResponse {
  nodeId: string
  assignments: AssignmentData[]
}

export interface ConditionData {
  id: number
  conditionOrder: number
  name: string | null
  expression: string | null
  isElse: boolean
  edgeId: string | null
  targetNodeName: string | null
}

export interface ConditionDataResponse {
  nodeId: string
  conditions: ConditionData[]
}

/** @deprecated renamed to ConditionDataResponse */
export type DecisionDataResponse = ConditionDataResponse

export interface SpelValidateResponse {
  valid: boolean
  error: string | null
}

// ── Transition editor response ────────────────────────────────────────────────

export interface TransitionLayerData {
  id: number
  layerOrder: number
  assetId: string
  freezeLastFrame: boolean
  assetFileName: string
  hasAlpha: boolean
  duration: number | null
  startAt: number
  alphaError: boolean
}

export interface TransitionAudioData {
  id: number
  trackOrder: number
  assetId: string
  assetFileName: string
  duration: number | null
  startAt: number
}

export interface TransitionResponse {
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  targetNodeType: string
  transitionAllowed: boolean
  type: TransitionType | null
  duration: number | null
  videoLayers: TransitionLayerData[]
  audioTracks: TransitionAudioData[]
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  nodeId: string | null
  edgeId: string | null
}

export interface ValidationReport {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

// ── Project config ───────────────────────────────────────────────────────────

export interface ProjectConfig {
  name: string
  assetsDirectory?: string
  outputDirectory?: string
  previewResolution?: string
  compileResolutions?: string[]
  fps: number
  audioSampleRate: number
  audioBitRate: number
  decisionTimeoutSecs: number
  defaultLocaleCode?: string
  ffmpegThreads?: number | null    // null = Auto (let FFmpeg decide)
}

// ── Localization ─────────────────────────────────────────────────────────────

export interface Locale {
  code: string
  name: string
}

export interface SubtitleEntry {
  id: string
  sceneId: string
  localeCode: string
  startTime: number
  endTime: number
  text: string
}

export interface DecisionTranslation {
  id: string
  decisionKey: string
  sceneId: string
  localeCode: string
  label: string
}

// ── API response wrappers ────────────────────────────────────────────────────

export interface HealthResponse {
  status: string
}
