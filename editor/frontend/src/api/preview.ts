import apiClient from './client'

export interface PreviewJobStatus {
  jobId: string
  type: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled'
  progress: number
  statusText: string
  error: string
  fileUrl: string
}

export const startScenePreview      = (nodeId: string) =>
  apiClient.post<PreviewJobStatus>(`/preview/scene/${nodeId}`, {})

export const startTransitionPreview = (edgeId: string) =>
  apiClient.post<PreviewJobStatus>(`/preview/transition/${edgeId}`, {})

export const getPreviewStatus       = (jobId: string) =>
  apiClient.get<PreviewJobStatus>(`/preview/status/${jobId}`)

export const cancelPreview          = (jobId: string) =>
  apiClient.post<PreviewJobStatus>(`/preview/cancel/${jobId}`, {})

export const previewFileUrl         = (jobId: string) => `/api/preview/file/${jobId}`
