const BASE = '/api/custom-css'

export type CssFileName = 'custom' | 'buttons' | 'subtitles'

export async function getCustomCss(name: CssFileName = 'custom'): Promise<string> {
  const url = name === 'custom' ? BASE : `${BASE}/${name}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

export async function saveCustomCss(content: string, name: CssFileName = 'custom'): Promise<void> {
  const url = name === 'custom' ? BASE : `${BASE}/${name}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: content,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}
