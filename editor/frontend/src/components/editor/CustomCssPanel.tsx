import { useState, useEffect, useRef, useCallback } from 'react'
import { getCustomCss, saveCustomCss, type CssFileName } from '@/api/customCss'

// ── Tab definitions ──────────────────────────────────────────────────────────

interface TabDef {
  key: CssFileName
  label: string
  description: string
  placeholder: string
}

const TABS: TabDef[] = [
  {
    key: 'buttons',
    label: 'Buttons',
    description: 'Style decision buttons and their container. Loaded as buttons.css.',
    placeholder:
      '/* Decision button styling */\n\n' +
      '.decision-btn {\n  border-radius: 20px;\n  font-size: 16px;\n}\n\n' +
      '.decision-btn:hover {\n  background: rgba(255,255,255,0.2);\n}',
  },
  {
    key: 'subtitles',
    label: 'Subtitles',
    description: 'Style the subtitle overlay and text. Loaded as subtitles.css.',
    placeholder:
      '/* Subtitle styling */\n\n' +
      '#subtitle-text {\n  font-size: 22px;\n  background: rgba(0,0,0,0.85);\n  color: #ffe066;\n}\n\n' +
      '#subtitle-container {\n  bottom: 10%;\n}',
  },
  {
    key: 'custom',
    label: 'General',
    description: 'General overrides for any runtime element. Loaded last as custom.css.',
    placeholder:
      '/* General runtime overrides */\n\n' +
      ':root {\n  --arvexis-accent: #ff6b6b;\n}\n\n' +
      '#stage {\n  background: #111;\n}',
  },
]

const REF_TAB_KEY = '__reference__'

// ── Single-tab editor ────────────────────────────────────────────────────────

function CssTabEditor({ tab }: { tab: TabDef }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getCustomCss(tab.key)
      .then(setContent)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [tab.key])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await saveCustomCss(content, tab.key)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [content, tab.key])

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const val = ta.value
      const newVal = val.substring(0, start) + '  ' + val.substring(end)
      setContent(newVal)
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2 })
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 shrink-0">
        <p className="text-[11px] text-muted-foreground leading-relaxed flex-1 mr-3">
          {tab.description}{' '}
          <kbd className="text-[10px] bg-muted px-1 py-0.5 rounded">Ctrl+S</kbd> to save.
        </p>
        <div className="flex items-center gap-2 shrink-0">
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
      <div className="flex-1 min-h-0 p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="w-full h-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder={tab.placeholder}
          />
        )}
      </div>
    </div>
  )
}

// ── CSS Reference ────────────────────────────────────────────────────────────

const CSS_REFERENCE: { section: string; items: { selector: string; desc: string }[] }[] = [
  {
    section: 'Decision Buttons',
    items: [
      { selector: '#decision-overlay', desc: 'Full-screen overlay; use [data-position] for layout' },
      { selector: '#decision-buttons', desc: 'Inner flex column holding buttons' },
      { selector: '.decision-btn', desc: 'Each decision button' },
      { selector: '.decision-btn.default', desc: 'Default choice (highlighted border)' },
      { selector: '.decision-btn:hover', desc: 'Hovered state' },
    ],
  },
  {
    section: 'Subtitles',
    items: [
      { selector: '#subtitle-container', desc: 'Positioned wrapper (bottom-center by default)' },
      { selector: '#subtitle-text', desc: 'Inline text span — font, color, bg, padding' },
      { selector: '#subtitle-text:empty', desc: 'Hidden when no subtitle showing' },
    ],
  },
  {
    section: 'Video & Stage',
    items: [
      { selector: '#stage', desc: 'Video area container' },
      { selector: '#video-el', desc: 'Main scene <video>' },
      { selector: '#transition-el', desc: 'Transition overlay <video>' },
      { selector: '#freeze-canvas', desc: 'Freeze-frame <canvas>' },
    ],
  },
  {
    section: 'Countdown Timer',
    items: [
      { selector: '#countdown', desc: 'Decision countdown (top-right)' },
      { selector: '#countdown-arc', desc: 'Circular arc canvas' },
      { selector: '#countdown-num', desc: 'Remaining seconds text' },
    ],
  },
  {
    section: 'Loading & Errors',
    items: [
      { selector: '#spinner', desc: 'Loading spinner overlay' },
      { selector: '.spinner-ring', desc: 'Animated ring' },
      { selector: '#spinner-text', desc: 'Loading message' },
      { selector: '#error-box', desc: 'Error overlay' },
      { selector: '#error-msg', desc: 'Error message text' },
      { selector: '#error-retry', desc: 'Retry button' },
    ],
  },
  {
    section: 'End Screen',
    items: [
      { selector: '#end-screen', desc: 'Game over overlay' },
      { selector: '#end-title', desc: '"The End" heading' },
      { selector: '#end-restart', desc: '"Play Again" button' },
      { selector: '#end-menu', desc: '"Main Menu" button' },
    ],
  },
  {
    section: 'Main Menu',
    items: [
      { selector: '#main-menu', desc: 'Main menu screen' },
      { selector: '.menu-title', desc: 'Game title text' },
      { selector: '.menu-actions', desc: 'Menu button group' },
      { selector: '#btn-continue', desc: 'Continue saved game' },
      { selector: '#btn-new-game', desc: 'New Game button' },
      { selector: '#btn-menu-settings', desc: 'Settings button' },
    ],
  },
  {
    section: 'Pause Overlay',
    items: [
      { selector: '#pause-overlay', desc: 'Pause menu overlay' },
      { selector: '.pause-title', desc: '"Paused" heading' },
      { selector: '.pause-actions', desc: 'Pause button group' },
      { selector: '#pause-btn', desc: 'Pause icon (top-left during gameplay)' },
    ],
  },
  {
    section: 'Settings Overlay',
    items: [
      { selector: '#settings-overlay', desc: 'Settings panel overlay' },
      { selector: '.settings-title', desc: '"Settings" heading' },
      { selector: '.settings-body', desc: 'Scrollable settings area' },
      { selector: '.settings-group', desc: 'Individual setting row' },
      { selector: '.settings-label', desc: 'Setting label' },
      { selector: '.settings-control', desc: 'Input/slider wrapper' },
      { selector: '#btn-settings-close', desc: 'Apply & Close button' },
    ],
  },
  {
    section: 'CSS Custom Properties (on :root)',
    items: [
      { selector: '--arvexis-bg', desc: 'Page background color' },
      { selector: '--arvexis-text', desc: 'Primary text color' },
      { selector: '--arvexis-accent', desc: 'Accent / highlight color' },
      { selector: '--arvexis-menu-bg', desc: 'Menu screen background (gradient)' },
      { selector: '--arvexis-overlay-bg', desc: 'Overlay / pause background' },
      { selector: '--arvexis-btn-bg', desc: 'Decision button background' },
      { selector: '--arvexis-btn-text', desc: 'Decision button text color' },
      { selector: '--arvexis-btn-border', desc: 'Decision button border color' },
      { selector: '--arvexis-btn-hover-bg', desc: 'Decision button hover bg' },
      { selector: '--arvexis-spinner-color', desc: 'Loading spinner color' },
    ],
  },
]

function CssReferenceTab() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
      <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
        Reference of all runtime UI elements and CSS custom properties you can override.
        CSS load order: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">default.css</code>{' '}
        &rarr; <code className="text-[10px] bg-muted px-1 py-0.5 rounded">buttons.css</code>{' '}
        &rarr; <code className="text-[10px] bg-muted px-1 py-0.5 rounded">subtitles.css</code>{' '}
        &rarr; <code className="text-[10px] bg-muted px-1 py-0.5 rounded">custom.css</code>
      </p>
      {CSS_REFERENCE.map((group) => (
        <div key={group.section} className="mb-4">
          <h4 className="text-xs font-semibold text-foreground mb-1.5">{group.section}</h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-[11px]">
              <tbody>
                {group.items.map((item, i) => (
                  <tr key={item.selector} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                    <td className="px-2.5 py-1.5 font-mono text-primary/80 whitespace-nowrap align-top">
                      {item.selector}
                    </td>
                    <td className="px-2.5 py-1.5 text-muted-foreground">{item.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

export default function CustomCssPanel() {
  const [activeTab, setActiveTab] = useState<CssFileName | typeof REF_TAB_KEY>('buttons')

  const allTabs: { key: string; label: string }[] = [
    ...TABS.map((t) => ({ key: t.key, label: t.label })),
    { key: REF_TAB_KEY, label: 'Reference' },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground mr-3">Custom CSS</h3>
        {allTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as CssFileName | typeof REF_TAB_KEY)}
            className={[
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              activeTab === t.key
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === REF_TAB_KEY ? (
        <CssReferenceTab />
      ) : (
        <CssTabEditor key={activeTab} tab={TABS.find((t) => t.key === activeTab)!} />
      )}
    </div>
  )
}
