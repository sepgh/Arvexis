import apiClient from './client'
import type { ProjectConfig } from '@/types'

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
