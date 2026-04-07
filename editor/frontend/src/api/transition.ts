import apiClient from './client'
import type { AmbientConfigRequest, TransitionResponse, TransitionType } from '@/types'
import type { VideoLayerRequest, AudioTrackRequest } from './nodeEditor'

export const getTransition   = (edgeId: string) =>
  apiClient.get<TransitionResponse>(`/edges/${edgeId}/transition`)

export const setTransitionType = (edgeId: string, type: TransitionType, duration?: number | null) =>
  apiClient.put<TransitionResponse>(`/edges/${edgeId}/transition`, { type, duration })

export const saveTransitionLayers = (edgeId: string, layers: VideoLayerRequest[]) =>
  apiClient.put<TransitionResponse>(`/edges/${edgeId}/transition/layers`, layers)

export const saveTransitionAudio = (edgeId: string, tracks: AudioTrackRequest[]) =>
  apiClient.put<TransitionResponse>(`/edges/${edgeId}/transition/audio`, tracks)

export const setTransitionBackgroundColor = (edgeId: string, backgroundColor: string | null) =>
  apiClient.put<TransitionResponse>(`/edges/${edgeId}/transition/background-color`, { backgroundColor })

export const setTransitionAmbient = (edgeId: string, ambient: AmbientConfigRequest) =>
  apiClient.put<TransitionResponse>(`/edges/${edgeId}/transition/ambient`, ambient)
