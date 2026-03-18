import { useState, useEffect } from 'react'
import type { ConditionDataResponse } from '@/types'
import { getConditionData, saveConditions, type ConditionRequest } from '@/api/nodeEditor'
import SpelInput from './SpelInput'

interface ConditionEditorProps {
  nodeId: string
  onConditionsChanged?: () => void
}

export default function ConditionEditor({ nodeId, onConditionsChanged }: ConditionEditorProps) {
  const [data, setData]       = useState<ConditionDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Local draft expressions (null = else)
  const [drafts, setDrafts] = useState<(string | null)[]>([])

  const [names, setNames] = useState<(string | null)[]>([])

  useEffect(() => {
    setLoading(true)
    getConditionData(nodeId)
      .then(d => {
        setData(d)
        setDrafts(d.conditions.map(c => c.isElse ? null : c.expression))
        setNames(d.conditions.map(c => c.name ?? null))
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [nodeId])

  async function save(newDrafts: (string | null)[], newNames?: (string | null)[]) {
    setSaving(true); setError(null)
    const effectiveNames = newNames ?? names
    const reqs: ConditionRequest[] = newDrafts.map((expr, i) => ({
      name: effectiveNames[i] ?? null,
      expression: expr,
      isElse: expr === null,
    }))
    try {
      const result = await saveConditions(nodeId, reqs)
      setData(result)
      setDrafts(result.conditions.map(c => c.isElse ? null : c.expression))
      setNames(result.conditions.map(c => c.name ?? null))
      onConditionsChanged?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function ensureElse(exprs: (string | null)[], nms: (string | null)[]): { exprs: (string | null)[], nms: (string | null)[] } {
    const withoutElse = exprs.map((e, i) => ({ e, n: nms[i] })).filter(x => x.e !== null)
    return {
      exprs: [...withoutElse.map(x => x.e), null],
      nms:   [...withoutElse.map(x => x.n), null],
    }
  }

  function addCondition() {
    const { exprs, nms } = ensureElse(
      [...drafts.filter(d => d !== null), '#SCORE > 0', null],
      [...names.filter((_, i) => drafts[i] !== null), `Condition ${drafts.filter(d => d !== null).length + 1}`, null]
    )
    setDrafts(exprs); setNames(nms)
    save(exprs, nms)
  }

  function removeCondition(i: number) {
    if (drafts[i] === null) return
    const { exprs, nms } = ensureElse(
      drafts.filter((_, idx) => idx !== i),
      names.filter((_, idx) => idx !== i)
    )
    setDrafts(exprs); setNames(nms)
    save(exprs, nms)
  }

  function moveCondition(i: number, dir: -1 | 1) {
    if (drafts[i] === null) return
    const pairs = drafts.map((e, idx) => ({ e, n: names[idx] })).filter(x => x.e !== null)
    const condI = pairs.findIndex(x => x.e === drafts[i])
    if (condI + dir < 0 || condI + dir >= pairs.length) return
    ;[pairs[condI], pairs[condI + dir]] = [pairs[condI + dir], pairs[condI]]
    const { exprs, nms } = ensureElse(pairs.map(x => x.e), pairs.map(x => x.n))
    setDrafts(exprs); setNames(nms)
    save(exprs, nms)
  }

  function updateDraft(i: number, val: string) {
    if (drafts[i] === null) return
    const next = [...drafts]; next[i] = val; setDrafts(next)
  }

  function updateName(i: number, val: string) {
    if (drafts[i] === null) return
    const next = [...names]; next[i] = val || null; setNames(next)
  }

  if (loading) return <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">Loading…</div>

  const conditions = data?.conditions ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {error && <div className="mx-3 my-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}

      <div className="text-muted-foreground border-b border-border/50 flex items-center justify-between" style={{ padding: '14px 20px', fontSize: 14 }}>
        <span>{conditions.filter(c => !c.isElse).length} condition{conditions.filter(c => !c.isElse).length !== 1 ? 's' : ''} + else</span>
        {saving && <span>Saving…</span>}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 20, gap: 16 }}>
        {drafts.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No conditions yet. Add conditions below — the else branch always stays last.
          </p>
        )}

        {drafts.map((expr, i) => {
          const isElse = expr === null
          const condData = conditions[i]
          return (
            <div key={i} style={{ padding: 16, gap: 12 }} className={[
              'rounded-lg border flex flex-col',
              isElse ? 'border-violet-500/30 bg-violet-500/5' : 'border-border/50 bg-muted/40',
            ].join(' ')}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {isElse ? 'else' : `#${i + 1}`}
                </span>
                {condData?.targetNodeName && (
                  <span className="text-xs text-violet-400 truncate">→ {condData.targetNodeName}</span>
                )}
                {!isElse && (
                  <div className="ml-auto flex items-center gap-0.5">
                    <button onClick={() => moveCondition(i, -1)} disabled={i === 0} className="w-6 h-6 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-sm">↑</button>
                    <button onClick={() => moveCondition(i, 1)}  disabled={drafts[i + 1] === null} className="w-6 h-6 text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-sm">↓</button>
                    <button onClick={() => removeCondition(i)} className="w-6 h-6 text-muted-foreground hover:text-red-400 flex items-center justify-center text-sm">×</button>
                  </div>
                )}
              </div>

              {isElse ? (
                <p className="text-xs text-muted-foreground italic">
                  Matches when no other condition is true.
                  {!condData?.edgeId && ' Connect an edge from the else handle to route this branch.'}
                </p>
              ) : (
                <>
                  {/* Condition name (shown as handle label on the node) */}
                  <input
                    value={names[i] ?? ''}
                    onChange={e => updateName(i, e.target.value)}
                    onBlur={() => save(drafts)}
                    placeholder="Condition name (shown on node exit handle)"
                    className="input-base text-xs py-1"
                  />
                  <SpelInput
                    value={expr ?? ''}
                    onChange={v => updateDraft(i, v)}
                    onBlur={() => save(drafts)}
                    mode="boolean"
                    placeholder="#SCORE > 50"
                  />
                </>
              )}
            </div>
          )
        })}

        <button
          onClick={addCondition}
          className="rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
          style={{ marginTop: 4, padding: '12px 16px', fontSize: 14 }}
        >
          + Add condition
        </button>
      </div>
    </div>
  )
}
