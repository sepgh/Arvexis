import apiClient from './client'
import type { Locale, SubtitleEntry, DecisionTranslation } from '@/types'

// ── Locales ──────────────────────────────────────────────────────────────────

export function listLocales(): Promise<Locale[]> {
  return apiClient.get('/locales')
}

export function addLocale(code: string, name: string): Promise<Locale> {
  return apiClient.post('/locales', { code, name })
}

export function deleteLocale(code: string): Promise<{ deleted: string }> {
  return apiClient.delete(`/locales/${encodeURIComponent(code)}`)
}

// ── Subtitles ────────────────────────────────────────────────────────────────

export function getSubtitles(params?: { sceneId?: string; locale?: string }): Promise<SubtitleEntry[]> {
  const q = new URLSearchParams()
  if (params?.sceneId) q.set('sceneId', params.sceneId)
  if (params?.locale) q.set('locale', params.locale)
  const qs = q.toString()
  return apiClient.get(`/subtitles${qs ? '?' + qs : ''}`)
}

export function upsertSubtitle(entry: {
  id?: string
  sceneId: string
  localeCode: string
  startTime: number
  endTime: number
  text: string
}): Promise<SubtitleEntry> {
  return apiClient.post('/subtitles', entry)
}

export function deleteSubtitle(id: string): Promise<{ deleted: string }> {
  return apiClient.delete(`/subtitles/${encodeURIComponent(id)}`)
}

// ── Decision Translations ────────────────────────────────────────────────────

export function getDecisionTranslations(params?: { sceneId?: string; locale?: string }): Promise<DecisionTranslation[]> {
  const q = new URLSearchParams()
  if (params?.sceneId) q.set('sceneId', params.sceneId)
  if (params?.locale) q.set('locale', params.locale)
  const qs = q.toString()
  return apiClient.get(`/decision-translations${qs ? '?' + qs : ''}`)
}

export function upsertDecisionTranslation(entry: {
  id?: string
  decisionKey: string
  sceneId: string
  localeCode: string
  label: string
}): Promise<DecisionTranslation> {
  return apiClient.post('/decision-translations', entry)
}

export function deleteDecisionTranslation(id: string): Promise<{ deleted: string }> {
  return apiClient.delete(`/decision-translations/${encodeURIComponent(id)}`)
}
