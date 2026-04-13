import apiClient from './client'
import type { AmbientConfigRequest, GraphNode, GraphEdge } from '@/types'

export interface CreateNodePayload {
  id?: string
  name: string
  type: string
  posX?: number
  posY?: number
}

export interface UpdateNodePayload {
  name?: string
  isEnd?: boolean
  autoContinue?: boolean
  loopVideo?: boolean
  backgroundColor?: string
  clearBackgroundColor?: boolean
  decisionAppearanceConfig?: string
  musicAssetId?: string | null
  clearMusicAsset?: boolean
  ambient?: AmbientConfigRequest
  hideDecisionButtons?: boolean | null
  showDecisionInputIndicator?: boolean | null
  clearDecisionInputModeOverride?: boolean
  posX?: number
  posY?: number
}

export interface CreateEdgePayload {
  id?: string
  sourceNodeId: string
  targetNodeId: string
  sourceDecisionKey?: string
  sourceConditionOrder?: number
  sourceConditionName?: string
}

export interface UpdateEdgePayload {
  transitionType?: string
  transitionDuration?: number
  transitionConfig?: string
}

export const listNodes  = () => apiClient.get<GraphNode[]>('/nodes')
export const getNode    = (id: string) => apiClient.get<GraphNode>(`/nodes/${id}`)
export const createNode = (p: CreateNodePayload) => apiClient.post<GraphNode>('/nodes', p)
export const updateNode = (id: string, p: UpdateNodePayload) => apiClient.put<GraphNode>(`/nodes/${id}`, p)
export const deleteNode = (id: string) => apiClient.delete<void>(`/nodes/${id}`)
export const setRoot    = (id: string) => apiClient.put<GraphNode>(`/nodes/${id}/root`, {})
export const clearRoot  = () => apiClient.delete<void>('/nodes/root')

export const listEdges  = () => apiClient.get<GraphEdge[]>('/edges')
export const createEdge = (p: CreateEdgePayload) => apiClient.post<GraphEdge>('/edges', p)
export const updateEdge = (id: string, p: UpdateEdgePayload) => apiClient.put<GraphEdge>(`/edges/${id}`, p)
export const deleteEdge = (id: string) => apiClient.delete<void>(`/edges/${id}`)
