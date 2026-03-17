import apiClient from './client'
import type { PreviewJobStatus } from './preview'

export interface ManifestResult {
  message: string
  path: string
  downloadUrl: string
}

export interface CompileJobResult {
  jobId: string
  status: string
  progress: number
  statusText: string
  statusUrl: string
}

export const generateManifest = () => apiClient.post<ManifestResult>('/compile/manifest', {})

export const startCompilation = () => apiClient.post<CompileJobResult>('/compile/run', {})

export const getCompileStatus = (jobId: string) =>
  apiClient.get<PreviewJobStatus>(`/preview/status/${jobId}`)

export const cancelCompile = (jobId: string) =>
  apiClient.post<PreviewJobStatus>(`/preview/cancel/${jobId}`, {})

export const manifestDownloadUrl = () => '/api/compile/manifest'

export const compileDownloadUrl = () => '/api/compile/download'
