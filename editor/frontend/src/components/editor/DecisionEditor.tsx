import { useState, useEffect } from 'react'
import type { DecisionDataResponse } from '@/types'
import { getDecisionData, saveConditions, type ConditionRequest } from '@/api/nodeEditor'
import SpelInput from './SpelInput'

interface DecisionEditorProps {
  nodeId: string
}

export default function DecisionEditor({ nodeId }: DecisionEditorProps) {
  const [data, setData]       = useState<DecisionDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Local draft expressions (null = else)
  const [drafts, setDrafts] = useState<(string | null)[]>([])

  useEffect(() => {
    setLoading(true)
    getDecisionData(nodeId)
      .then(d => {
        setData(d)
        setDrafts(d.conditions.map(c => c.isElse ? null : c.expression))
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [nodeId])

  async function save(newDrafts: (string | null)[]) {
    setSaving(true); setError(null)
    const reqs: ConditionRequest[] = newDrafts.map(expr => ({
      expression: expr,
      isElse: expr === null,
    }))
    try {
      const result = await saveConditions(nodeId, reqs)
      setData(result)
      setDrafts(result.conditions.map(c => c.isElse ? null : c.expression))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function ensureElse(drafts: (string | null)[]): (string | null)[] {
    // Remove any existing else entries, then append one
    const withoutElse = drafts.filter(d => d !== null)
    return [...withoutElse, null]
  }

  function addCondition() {
    const next = ensureElse([...drafts.filter(d => d !== null), '#SCORE > 0', null])
    setDrafts(next)
    save(next)
  }

  function removeCondition(i: number) {
    if (drafts[i] === null) return // cannot remove else
    const next = ensureElse(drafts.filter((_, idx) => idx !== i))
    setDrafts(next)
    save(next)
  }

  function moveCondition(i: number, dir: -1 | 1) {
    if (drafts[i] === null) return // cannot move else
    const conditions = drafts.filter(d => d !== null)
    const condI = conditions.indexOf(drafts[i] as string)
    if (condI + dir < 0 || condI + dir >= conditions.length) return
    ;[conditions[condI], conditions[condI + dir]] = [conditions[condI + dir], conditions[condI]]
    const next = ensureElse(conditions)
    setDrafts(next)
    save(next)
  }

  function updateDraft(i: number, val: string) {
    if (drafts[i] === null) return
    const next = [...drafts]
    next[i] = val
    setDrafts(next)
  }

  if (loading) return <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">Loading…</div>

  const conditions = data?.conditions ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {error && <div className="mx-3 my-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}

      <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/50 flex items-center justify-between">
        <span>{conditions.filter(c => !c.isElse).length} condition{conditions.filter(c => !c.isElse).length !== 1 ? 's' : ''} + else</span>
        {saving && <span>Saving…</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {drafts.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No conditions. Add conditions below — the else branch always remains last.
          </p>
        )}

        {drafts.map((expr, i) => {
          const isElse = expr === null
          const condData = conditions[i]
          return (
            <div key={i} className={[
              'rounded-lg border p-2.5 flex flex-col gap-2',
              isElse ? 'border-violet-500/30 bg-violet-500/5' : 'border-border/50 bg-muted/40',
            ].join(' ')}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {isElse ? 'else' : `#${i + 1}`}
                </span>
                {condData?.targetNodeName && (
                  <span className="text-[10px] text-violet-400 truncate">→ {condData.targetNodeName}</span>
                )}
                {!isElse && (
                  <div className="ml-auto flex items-center gap-0.5">
                    <button onClick={() => moveCondition(i, -1)} disabled={i === 0} className="w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs">↑</button>
                    <button onClick={() => moveCondition(i, 1)}  disabled={drafts[i + 1] === null} className="w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs">↓</button>
                    <button onClick={() => removeCondition(i)} className="w-5 h-5 text-muted-foreground hover:text-red-400 flex items-center justify-center">×</button>
                  </div>
                )}
              </div>

              {isElse ? (
                <p className="text-[10px] text-muted-foreground italic">
                  Matches when no other condition is true.
                  {!condData?.edgeId && ' No outgoing edge assigned yet.'}
                </p>
              ) : (
                <SpelInput
                  value={expr ?? ''}
                  onChange={v => updateDraft(i, v)}
                  onBlur={() => save(drafts)}
                  mode="boolean"
                  placeholder="#SCORE > 50"
                />
              )}
            </div>
          )
        })}

        <button
          onClick={addCondition}
          className="mt-1 px-4 py-2 text-xs rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
        >
          + Add condition
        </button>
      </div>
    </div>
  )
}
