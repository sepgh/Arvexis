import { useEditorStore } from '@/store'

const BASE_URL = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}: ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.message) message = body.message
    } catch { /* ignore parse errors */ }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

// ── Mutation tracking ─────────────────────────────────────────────────────────
// Tracks in-flight write requests; updates save status in the Zustand store.
// Uses getState() so it works outside React components.

let inflightCount = 0
let savedTimer: ReturnType<typeof setTimeout> | null = null

function setSaving() {
  if (savedTimer) { clearTimeout(savedTimer); savedTimer = null }
  inflightCount++
  useEditorStore.getState().setSaveStatus('saving')
}

function onMutationDone() {
  inflightCount = Math.max(0, inflightCount - 1)
  if (inflightCount === 0) {
    savedTimer = setTimeout(() => {
      useEditorStore.getState().setSaveStatus('saved')
      savedTimer = setTimeout(() => {
        useEditorStore.getState().setSaveStatus('idle')
      }, 3000)
    }, 200)
  }
}

function onMutationError(msg: string) {
  inflightCount = Math.max(0, inflightCount - 1)
  if (savedTimer) { clearTimeout(savedTimer); savedTimer = null }
  useEditorStore.getState().setSaveStatus('error', msg)
}

async function mutate<T>(path: string, init: RequestInit): Promise<T> {
  setSaving()
  try {
    const result = await request<T>(path, init)
    onMutationDone()
    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Save failed'
    onMutationError(msg)
    throw e
  }
}

const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    mutate<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    mutate<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    mutate<T>(path, { method: 'DELETE' }),
}

export default apiClient
