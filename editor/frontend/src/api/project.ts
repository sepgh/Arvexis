import apiClient from './client'
import type { AmbientZone, ProjectConfig } from '@/types'

export interface ProjectStatus {
  open: boolean
  projectPath: string | null
  projectName: string | null
}

export interface CreateProjectPayload {
  directoryPath: string
  name: string
  assetsDirectory?: string
  outputDirectory?: string
  previewResolution?: string
  compileResolutions?: string[]
  fps?: number
  audioSampleRate?: number
  audioBitRate?: number
  decisionTimeoutSecs?: number
  defaultBackgroundColor?: string
  hideDecisionButtons?: boolean
  ffmpegThreads?: number | null
}

export interface UpdateProjectConfigPayload {
  name?: string
  assetsDirectory?: string
  outputDirectory?: string
  previewResolution?: string
  compileResolutions?: string[]
  ambientZones?: Array<Pick<AmbientZone, 'id' | 'name' | 'assetId' | 'defaultVolume' | 'defaultFadeMs' | 'loop'>>
  fps?: number
  audioSampleRate?: number
  audioBitRate?: number
  decisionTimeoutSecs?: number
  defaultLocaleCode?: string
  defaultBackgroundColor?: string
  hideDecisionButtons?: boolean
  showDecisionInputIndicator?: boolean
  ffmpegThreadsAuto?: boolean
  ffmpegThreads?: number | null
}

export function getProjectStatus(): Promise<ProjectStatus> {
  return apiClient.get<ProjectStatus>('/project/status')
}

export function createProject(payload: CreateProjectPayload): Promise<ProjectConfig> {
  return apiClient.post<ProjectConfig>('/project/create', payload)
}

export function openProject(directoryPath: string): Promise<ProjectConfig> {
  return apiClient.post<ProjectConfig>('/project/open', { directoryPath })
}

export function getProjectConfig(): Promise<ProjectConfig> {
  return apiClient.get<ProjectConfig>('/project/config')
}

export function updateProjectConfig(payload: UpdateProjectConfigPayload): Promise<ProjectConfig> {
  return apiClient.put<ProjectConfig>('/project/config', payload)
}
