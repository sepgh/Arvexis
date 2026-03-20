import apiClient from './client'
import type {
  SceneDataResponse, StateDataResponse, ConditionDataResponse,
  VideoLayerData, AudioTrackData, DecisionItemData,
  AssignmentData, ConditionData, SpelValidateResponse,
} from '@/types'

export interface VideoLayerRequest { assetId: string; startAt: number; startAtFrames?: number | null; freezeLastFrame?: boolean }
export interface AudioTrackRequest { assetId: string; startAt: number; startAtFrames?: number | null }
export interface DecisionItemRequest { decisionKey: string; isDefault: boolean; decisionOrder: number }
export interface AssignmentRequest { expression: string }
export interface ConditionRequest { name: string | null; expression: string | null; isElse: boolean }

// Scene
export const getSceneData    = (id: string) => apiClient.get<SceneDataResponse>(`/nodes/${id}/scene`)
export const saveVideoLayers = (id: string, layers: VideoLayerRequest[]) =>
  apiClient.put<SceneDataResponse>(`/nodes/${id}/scene/layers`, layers)
export const saveAudioTracks = (id: string, tracks: AudioTrackRequest[]) =>
  apiClient.put<SceneDataResponse>(`/nodes/${id}/scene/audio`, tracks)
export const saveDecisions   = (id: string, decisions: DecisionItemRequest[]) =>
  apiClient.put<SceneDataResponse>(`/nodes/${id}/scene/decisions`, decisions)

// State
export const getStateData      = (id: string) => apiClient.get<StateDataResponse>(`/nodes/${id}/state`)
export const saveAssignments   = (id: string, assignments: AssignmentRequest[]) =>
  apiClient.put<StateDataResponse>(`/nodes/${id}/state/assignments`, assignments)

// Condition node
export const getConditionData  = (id: string) => apiClient.get<ConditionDataResponse>(`/nodes/${id}/condition`)
export const saveConditions    = (id: string, conditions: ConditionRequest[]) =>
  apiClient.put<ConditionDataResponse>(`/nodes/${id}/condition/conditions`, conditions)

/** @deprecated use getConditionData */
export const getDecisionData   = getConditionData

// SpEL
export const validateSpel = (expression: string, mode: 'assignment' | 'boolean') =>
  apiClient.post<SpelValidateResponse>('/spel/validate', { expression, mode })

// Re-export types for convenience
export type { VideoLayerData, AudioTrackData, DecisionItemData, AssignmentData, ConditionData, ConditionDataResponse }
