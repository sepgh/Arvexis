import apiClient from './client'
import type { TransitionResponse, TransitionType } from '@/types'
import type { VideoLayerRequest, AudioTrackRequest } from './nodeEditor'

export const getTransition   = (edgeId: string) =>
  apiClient.get<TransitionResponse>(`/edges/${edgeId}/transition`)

export const setTransitionType = (edgeId: string, type: TransitionType, duration?: number | null) =>
  apiClient.put<TransitionResponse>(`/edges/${edgeId}/transition`, { type, duration })

export const saveTransitionLayers = (edgeId: string, layers: VideoLayerRequest[]) =>
  apiClient.put<TransitionResponse>(`/edges/${edgeId}/transition/layers`, layers)

export const saveTransitionAudio = (edgeId: string, tracks: AudioTrackRequest[]) =>
  apiClient.put<TransitionResponse>(`/edges/${edgeId}/transition/audio`, tracks)
