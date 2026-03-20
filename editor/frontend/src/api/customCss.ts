const BASE = '/api/custom-css'

export async function getCustomCss(): Promise<string> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

export async function saveCustomCss(content: string): Promise<void> {
  const res = await fetch(BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: content,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}
