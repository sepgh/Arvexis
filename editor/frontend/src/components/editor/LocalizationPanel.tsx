import { useState } from 'react'
import type { Locale } from '@/types'

const PLACEHOLDER_LOCALES: Locale[] = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
]

export default function LocalizationPanel() {
  const [locales] = useState<Locale[]>(PLACEHOLDER_LOCALES)
  const [activeLocale, setActiveLocale] = useState<string>(PLACEHOLDER_LOCALES[0].code)
  const [newCode, setNewCode]   = useState('')
  const [newName, setNewName]   = useState('')
  const [showAdd, setShowAdd]   = useState(false)

  function handleAddLocale() {
    if (!newCode.trim() || !newName.trim()) return
    // TODO: wire to backend when locale API is available
    setNewCode('')
    setNewName('')
    setShowAdd(false)
  }

  return (
    <div className="flex flex-col shrink-0 border-l border-border bg-card overflow-hidden h-full" style={{ width: 420 }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-emerald-400 shrink-0">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M7 1.5C5.5 3.5 4.5 5.2 4.5 7s1 3.5 2.5 5.5M7 1.5C8.5 3.5 9.5 5.2 9.5 7s-1 3.5-2.5 5.5M1.5 7h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Localization</span>
        <span className="ml-auto text-xs text-muted-foreground italic">Data model preview</span>
      </div>

      {/* Locale selector */}
      <div className="px-4 pt-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Locales</span>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="ml-auto text-xs px-2.5 py-1 rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
          >
            + Add
          </button>
        </div>

        {showAdd && (
          <div className="flex flex-col gap-1.5 mb-2">
            <div className="flex gap-1.5">
              <input
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                placeholder="Code (e.g. fr)"
                className="input-base text-xs py-1 w-20 shrink-0"
              />
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddLocale(); if (e.key === 'Escape') setShowAdd(false) }}
                placeholder="Name (e.g. French)"
                className="input-base text-xs py-1 flex-1"
              />
            </div>
            <button
              onClick={handleAddLocale}
              className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Add locale
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {locales.map(l => (
            <button
              key={l.code}
              onClick={() => setActiveLocale(l.code)}
              className={[
                'text-sm px-3 py-1.5 rounded-md border transition-colors',
                activeLocale === l.code
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'text-muted-foreground border-border hover:text-foreground hover:bg-accent',
              ].join(' ')}
            >
              {l.code.toUpperCase()} · {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3 flex flex-col gap-1.5">
          <p className="text-xs font-medium text-foreground">Subtitles</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Per-scene timed subtitle entries for locale <span className="text-emerald-400 font-medium">{activeLocale}</span>.
            Each entry has a start/end time and text.
          </p>
          <p className="text-[10px] text-muted-foreground/60 italic mt-1">
            Full subtitle editor coming in a future release.
          </p>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3 flex flex-col gap-1.5">
          <p className="text-xs font-medium text-foreground">Decision Labels</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Translated button labels for each decision key per scene for locale <span className="text-emerald-400 font-medium">{activeLocale}</span>.
          </p>
          <p className="text-[10px] text-muted-foreground/60 italic mt-1">
            Full translation editor coming in a future release.
          </p>
        </div>

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-[11px] text-emerald-400/80">
            The localization data model (locales, subtitles, decision translations) is stored in the database.
            The project default locale is set in <span className="font-medium">Project Settings</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
