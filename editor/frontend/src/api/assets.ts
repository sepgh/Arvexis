import apiClient from './client'
import type { Asset, ScanResult } from '@/types'

export interface AssetFilters {
  directory?: string
  mediaType?: string
  tags?: string[]
}

export function scanAssets(): Promise<ScanResult> {
  return apiClient.post<ScanResult>('/assets/scan')
}

export function listAssets(filters?: AssetFilters): Promise<Asset[]> {
  const params = new URLSearchParams()
  if (filters?.directory) params.set('directory', filters.directory)
  if (filters?.mediaType) params.set('mediaType', filters.mediaType)
  if (filters?.tags?.length) filters.tags.forEach((t) => params.append('tags', t))
  const query = params.toString()
  return apiClient.get<Asset[]>(`/assets${query ? '?' + query : ''}`)
}

export function getAsset(id: string): Promise<Asset> {
  return apiClient.get<Asset>(`/assets/${id}`)
}

export function addTag(assetId: string, tag: string): Promise<Asset> {
  return apiClient.post<Asset>(`/assets/${assetId}/tags`, { tag })
}

export function removeTag(assetId: string, tag: string): Promise<void> {
  return apiClient.delete<void>(`/assets/${assetId}/tags/${encodeURIComponent(tag)}`)
}

export function listTags(): Promise<string[]> {
  return apiClient.get<string[]>('/tags')
}

export function listFolders(): Promise<string[]> {
  return apiClient.get<string[]>('/assets/folders')
}

export function createFolder(path: string): Promise<{ path: string }> {
  return apiClient.post<{ path: string }>('/assets/folder', { path })
}

export function uploadAsset(file: File, folder?: string): Promise<Asset> {
  const form = new FormData()
  form.append('file', file)
  if (folder) form.append('folder', folder)
  return apiClient.postForm<Asset>('/assets/upload', form)
}
