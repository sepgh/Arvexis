import { useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Locale, SubtitleEntry, DecisionTranslation, GraphNode } from '@/types'
import {
  listLocales, addLocale, deleteLocale,
  getSubtitles, upsertSubtitle, deleteSubtitle,
  getDecisionTranslations, upsertDecisionTranslation, deleteDecisionTranslation,
} from '@/api/localization'
import { listNodes } from '@/api/graph'
import { useEditorStore } from '@/store'

type Tab = 'subtitles' | 'decisions'

export default function LocalizationPanel() {
  const togglePanel = useEditorStore(s => s.toggleLocalizationPanel)

  const [locales, setLocales]             = useState<Locale[]>([])
  const [activeLocale, setActiveLocale]   = useState<string>('')
  const [newCode, setNewCode]             = useState('')
  const [newName, setNewName]             = useState('')
  const [showAdd, setShowAdd]             = useState(false)
  const [scenes, setScenes]               = useState<GraphNode[]>([])
  const [selectedScene, setSelectedScene] = useState<string>('')
  const [tab, setTab]                     = useState<Tab>('subtitles')
  const [error, setError]                 = useState<string | null>(null)

  // Subtitle state
  const [subs, setSubs]               = useState<SubtitleEntry[]>([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [newSubStart, setNewSubStart] = useState('')
  const [newSubEnd, setNewSubEnd]     = useState('')
  const [newSubText, setNewSubText]   = useState('')

  // Decision translation state
  const [translations, setTranslations]             = useState<DecisionTranslation[]>([])
  const [transLoading, setTransLoading]             = useState(false)
  const [sceneDecisionKeys, setSceneDecisionKeys]   = useState<string[]>([])

  // ── Load locales + scenes on mount ──────────────────────────────────────

  useEffect(() => {
    Promise.all([listLocales(), listNodes()])
      .then(([locs, nodes]) => {
        setLocales(locs)
        if (locs.length > 0) setActiveLocale(prev => prev || locs[0].code)
        const sceneNodes = nodes.filter(n => n.type === 'scene')
        setScenes(sceneNodes)
        if (sceneNodes.length > 0) setSelectedScene(prev => prev || sceneNodes[0].id)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Load failed'))
  }, [])

  // ── Load subtitles when scene/locale changes ───────────────────────────

  const loadSubs = useCallback(async () => {
    if (!selectedScene || !activeLocale) { setSubs([]); return }
    setSubsLoading(true)
    try {
      const data = await getSubtitles({ sceneId: selectedScene, locale: activeLocale })
      setSubs(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load subtitles') }
    finally { setSubsLoading(false) }
  }, [selectedScene, activeLocale])

  useEffect(() => { if (tab === 'subtitles') loadSubs() }, [loadSubs, tab])

  // ── Load decision translations when scene/locale changes ───────────────

  const loadTranslations = useCallback(async () => {
    if (!selectedScene || !activeLocale) { setTranslations([]); return }
    setTransLoading(true)
    try {
      const data = await getDecisionTranslations({ sceneId: selectedScene, locale: activeLocale })
      setTranslations(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load translations') }
    finally { setTransLoading(false) }
  }, [selectedScene, activeLocale])

  useEffect(() => { if (tab === 'decisions') loadTranslations() }, [loadTranslations, tab])

  // ── Compute decision keys for the selected scene ───────────────────────

  useEffect(() => {
    const scene = scenes.find(s => s.id === selectedScene)
    if (scene) {
      setSceneDecisionKeys(scene.exits.filter(e => e.key !== 'CONTINUE').map(e => e.key))
    } else {
      setSceneDecisionKeys([])
    }
  }, [selectedScene, scenes])

  // ── Locale CRUD ─────────────────────────────────────────────────────────

  async function handleAddLocale() {
    const code = newCode.trim().toLowerCase()
    const name = newName.trim()
    if (!code || !name) {
      setError('Both locale code and name are required')
      return
    }
    setError(null)
    try {
      const loc = await addLocale(code, name)
      setLocales(prev => [...prev.filter(l => l.code !== loc.code), loc])
      if (!activeLocale) setActiveLocale(loc.code)
      setNewCode('')
      setNewName('')
      setShowAdd(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to add locale') }
  }

  async function handleDeleteLocale(code: string) {
    try {
      await deleteLocale(code)
      setLocales(prev => {
        const remaining = prev.filter(l => l.code !== code)
        if (activeLocale === code) {
          setActiveLocale(remaining.length > 0 ? remaining[0].code : '')
        }
        return remaining
      })
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to delete locale') }
  }

  // ── Subtitle CRUD ───────────────────────────────────────────────────────

  async function handleAddSubtitle() {
    const start = parseFloat(newSubStart)
    const end   = parseFloat(newSubEnd)
    const text  = newSubText.trim()
    if (isNaN(start) || isNaN(end) || !text || !selectedScene || !activeLocale) return
    try {
      await upsertSubtitle({ sceneId: selectedScene, localeCode: activeLocale, startTime: start, endTime: end, text })
      setNewSubStart('')
      setNewSubEnd('')
      setNewSubText('')
      loadSubs()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to add subtitle') }
  }

  async function handleUpdateSubtitle(entry: SubtitleEntry) {
    try {
      await upsertSubtitle(entry)
      loadSubs()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to update subtitle') }
  }

  async function handleDeleteSubtitle(id: string) {
    try {
      await deleteSubtitle(id)
      setSubs(prev => prev.filter(s => s.id !== id))
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to delete subtitle') }
  }

  // ── Decision translation CRUD ──────────────────────────────────────────

  async function handleUpsertTranslation(decisionKey: string, label: string, existingId?: string) {
    if (!label.trim() || !selectedScene || !activeLocale) return
    try {
      await upsertDecisionTranslation({
        id: existingId,
        decisionKey, sceneId: selectedScene, localeCode: activeLocale, label: label.trim(),
      })
      loadTranslations()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save translation') }
  }

  async function handleDeleteTranslation(id: string) {
    try {
      await deleteDecisionTranslation(id)
      setTranslations(prev => prev.filter(t => t.id !== id))
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to delete translation') }
  }

  return (
    <div className="flex flex-col w-full border-l border-border bg-card overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center border-b border-border shrink-0 bg-emerald-500/5" style={{ padding: '18px 24px', gap: 12 }}>
        <div className="flex-1 min-w-0">
          <span className="font-semibold uppercase tracking-wider text-emerald-400 opacity-70" style={{ fontSize: 12 }}>
            Localization
          </span>
          <p className="font-medium text-foreground" style={{ fontSize: 18, marginTop: 4 }}>Subtitles &amp; Translations</p>
        </div>
        <button
          onClick={togglePanel}
          className="text-muted-foreground hover:text-foreground leading-none shrink-0"
          style={{ fontSize: 22, padding: 4 }}
        >
          ×
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2" style={{ margin: '12px 20px 0', padding: '8px 12px' }}>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="opacity-70 hover:opacity-100 shrink-0" style={{ fontSize: 18 }}>×</button>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>
        <div className="flex flex-col gap-5">

          {/* ── Locales section ── */}
          <Field label="Locales" hint="Define languages available in your project">
            <div className="flex flex-col gap-3">
              {locales.length === 0 && !showAdd && (
                <p className="text-sm text-muted-foreground">No locales defined yet.</p>
              )}
              {locales.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {locales.map(l => (
                    <div key={l.code} className="relative group">
                      <button
                        type="button"
                        onClick={() => setActiveLocale(l.code)}
                        className={[
                          'font-medium rounded-md border transition-colors',
                          activeLocale === l.code
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'text-muted-foreground border-border hover:text-foreground hover:bg-accent',
                        ].join(' ')}
                        style={{ padding: '6px 28px 6px 12px', fontSize: 13 }}
                      >
                        {l.code.toUpperCase()} · {l.name}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteLocale(l.code) }}
                        className="absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                        style={{ right: 8, fontSize: 14 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showAdd && (
                <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="grid grid-cols-[80px_1fr] gap-2">
                    <input
                      value={newCode}
                      onChange={e => setNewCode(e.target.value)}
                      placeholder="fr"
                      className="input-base"
                    />
                    <input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddLocale(); if (e.key === 'Escape') { setShowAdd(false); setNewCode(''); setNewName('') } }}
                      placeholder="French"
                      className="input-base"
                    />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowAdd(false); setNewCode(''); setNewName('') }}
                      className="font-medium text-muted-foreground hover:text-foreground transition-colors"
                      style={{ padding: '6px 12px', fontSize: 13 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddLocale}
                      className="font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
                      style={{ padding: '6px 16px', fontSize: 13 }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {!showAdd && (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="font-medium text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary rounded-lg transition-colors self-start"
                  style={{ padding: '6px 16px', fontSize: 13 }}
                >
                  + Add Locale
                </button>
              )}
            </div>
          </Field>

          {/* ── Scene selector ── */}
          <Field label="Scene">
            <select
              value={selectedScene}
              onChange={e => setSelectedScene(e.target.value)}
              className="input-base"
            >
              {scenes.length === 0 && <option value="">No scenes</option>}
              {scenes.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>

          {/* ── Tab selector ── */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['subtitles', 'decisions'] as Tab[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={[
                  'flex-1 font-medium transition-colors capitalize',
                  tab === t
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                ].join(' ')}
                style={{ padding: '8px 0', fontSize: 13 }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── No locale prompt ── */}
          {!activeLocale && (
            <p className="text-sm text-muted-foreground text-center" style={{ padding: '16px 0' }}>
              Add a locale above to begin editing.
            </p>
          )}

          {/* ── Subtitles Tab ── */}
          {activeLocale && tab === 'subtitles' && (
            <div className="flex flex-col gap-3">
              {subsLoading ? (
                <p className="text-sm text-muted-foreground text-center" style={{ padding: '16px 0' }}>Loading…</p>
              ) : (
                <>
                  {subs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center" style={{ padding: '8px 0' }}>
                      No subtitles for this scene and locale.
                    </p>
                  )}
                  {subs.map(s => (
                    <SubtitleRow key={s.id} entry={s} onUpdate={handleUpdateSubtitle} onDelete={handleDeleteSubtitle} />
                  ))}

                  {/* Add new subtitle */}
                  <div className="rounded-lg border border-dashed border-border p-4 flex flex-col gap-3">
                    <span className="text-sm font-medium text-foreground">New Subtitle</span>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Start (s)">
                        <input
                          type="number" step="0.1" min="0"
                          value={newSubStart}
                          onChange={e => setNewSubStart(e.target.value)}
                          className="input-base"
                          placeholder="0.0"
                        />
                      </Field>
                      <Field label="End (s)">
                        <input
                          type="number" step="0.1" min="0"
                          value={newSubEnd}
                          onChange={e => setNewSubEnd(e.target.value)}
                          className="input-base"
                          placeholder="3.0"
                        />
                      </Field>
                    </div>
                    <Field label="Text">
                      <textarea
                        value={newSubText}
                        onChange={e => setNewSubText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAddSubtitle() }}
                        placeholder="Subtitle text…"
                        className="input-base resize-none"
                        rows={2}
                      />
                    </Field>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddSubtitle}
                        disabled={!newSubText.trim() || !newSubStart || !newSubEnd}
                        className="font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                        style={{ padding: '8px 20px', fontSize: 13 }}
                      >
                        Add Subtitle
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Decision Translations Tab ── */}
          {activeLocale && tab === 'decisions' && (
            <div className="flex flex-col gap-3">
              {transLoading ? (
                <p className="text-sm text-muted-foreground text-center" style={{ padding: '16px 0' }}>Loading…</p>
              ) : (
                <>
                  {sceneDecisionKeys.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center" style={{ padding: '8px 0' }}>
                      This scene has no explicit decisions.
                    </p>
                  )}
                  {sceneDecisionKeys.map(key => {
                    const existing = translations.find(t => t.decisionKey === key)
                    return (
                      <DecisionTranslationRow
                        key={key}
                        decisionKey={key}
                        existing={existing}
                        onSave={(label) => handleUpsertTranslation(key, label, existing?.id)}
                        onDelete={existing ? () => handleDeleteTranslation(existing.id) : undefined}
                      />
                    )
                  })}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SubtitleRow({ entry, onUpdate, onDelete }: {
  entry: SubtitleEntry
  onUpdate: (e: SubtitleEntry) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText]       = useState(entry.text)
  const [start, setStart]     = useState(String(entry.startTime))
  const [end, setEnd]         = useState(String(entry.endTime))

  useEffect(() => {
    setText(entry.text)
    setStart(String(entry.startTime))
    setEnd(String(entry.endTime))
  }, [entry])

  function save() {
    onUpdate({ ...entry, startTime: parseFloat(start) || 0, endTime: parseFloat(end) || 0, text })
    setEditing(false)
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40 flex flex-col" style={{ padding: 12 }}>
      <div className="flex items-center gap-2">
        <span className="text-emerald-400 font-mono shrink-0" style={{ fontSize: 12 }}>
          {Number(entry.startTime).toFixed(1)}s – {Number(entry.endTime).toFixed(1)}s
        </span>
        <span className="flex-1 text-sm text-foreground truncate">{entry.text}</span>
        <button
          type="button"
          onClick={() => setEditing(e => !e)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          style={{ fontSize: 12, padding: '2px 6px' }}
        >
          {editing ? 'cancel' : 'edit'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          className="text-muted-foreground hover:text-red-400 transition-colors leading-none"
          style={{ fontSize: 16, padding: '2px 4px' }}
        >
          ×
        </button>
      </div>
      {editing && (
        <div className="flex flex-col gap-2 border-t border-border/30" style={{ paddingTop: 10, marginTop: 10 }}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start (s)">
              <input type="number" step="0.1" value={start} onChange={e => setStart(e.target.value)} className="input-base" />
            </Field>
            <Field label="End (s)">
              <input type="number" step="0.1" value={end} onChange={e => setEnd(e.target.value)} className="input-base" />
            </Field>
          </div>
          <Field label="Text">
            <textarea value={text} onChange={e => setText(e.target.value)} className="input-base resize-none" rows={2} />
          </Field>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              className="font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              style={{ padding: '6px 16px', fontSize: 13 }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DecisionTranslationRow({ decisionKey, existing, onSave, onDelete }: {
  decisionKey: string
  existing?: DecisionTranslation
  onSave: (label: string) => void
  onDelete?: () => void
}) {
  const [label, setLabel] = useState(existing?.label ?? '')

  useEffect(() => { setLabel(existing?.label ?? '') }, [existing])

  return (
    <div className="rounded-lg border border-border bg-muted/40 flex flex-col gap-2" style={{ padding: 12 }}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-foreground">{decisionKey}</span>
        {existing && <span className="text-emerald-400" style={{ fontSize: 11 }}>translated</span>}
        {!existing && <span className="text-muted-foreground/60 italic" style={{ fontSize: 11 }}>not translated</span>}
        {existing && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto text-muted-foreground hover:text-red-400 transition-colors leading-none"
            style={{ fontSize: 16, padding: '2px 4px' }}
          >
            ×
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(label) }}
          placeholder="Translated label…"
          className="input-base flex-1"
        />
        <button
          type="button"
          onClick={() => onSave(label)}
          disabled={!label.trim()}
          className="font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0"
          style={{ padding: '6px 16px', fontSize: 13 }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
