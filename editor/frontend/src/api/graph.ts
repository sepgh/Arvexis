import apiClient from './client'
import type { GraphNode, GraphEdge } from '@/types'

export interface CreateNodePayload {
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
  decisionAppearanceConfig?: string
  musicAssetId?: string | null
  clearMusicAsset?: boolean
  posX?: number
  posY?: number
}

export interface CreateEdgePayload {
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

export const listEdges  = () => apiClient.get<GraphEdge[]>('/edges')
export const createEdge = (p: CreateEdgePayload) => apiClient.post<GraphEdge>('/edges', p)
export const updateEdge = (id: string, p: UpdateEdgePayload) => apiClient.put<GraphEdge>(`/edges/${id}`, p)
export const deleteEdge = (id: string) => apiClient.delete<void>(`/edges/${id}`)
