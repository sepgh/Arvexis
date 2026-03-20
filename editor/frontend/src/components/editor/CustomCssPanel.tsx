import { useState, useEffect, useRef } from 'react'
import { getCustomCss, saveCustomCss } from '@/api/customCss'

export default function CustomCssPanel() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLoading(true)
    getCustomCss()
      .then(setContent)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await saveCustomCss(content)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
    // Tab inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const val = ta.value
      const newVal = val.substring(0, start) + '  ' + val.substring(end)
      setContent(newVal)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground">Custom CSS</h3>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-400">Saved ✓</span>}
          {error && <span className="text-xs text-red-400 truncate max-w-[140px]">{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border/50 shrink-0">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Override the default runtime styles. This file is loaded after <code className="text-[10px] bg-muted px-1 py-0.5 rounded">default.css</code> in the runtime player.
          Press <kbd className="text-[10px] bg-muted px-1 py-0.5 rounded">Ctrl+S</kbd> to save.
        </p>
      </div>

      <div className="flex-1 min-h-0 p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="w-full h-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder="/* Add your custom styles here */&#10;&#10;.decision-btn {&#10;  border-radius: 20px;&#10;}"
          />
        )}
      </div>
    </div>
  )
}
