import { useState, useEffect } from 'react'

import { getStateData, saveAssignments, type AssignmentRequest } from '@/api/nodeEditor'
import SpelInput from './SpelInput'

interface StateEditorProps {
  nodeId: string
}

export default function StateEditor({ nodeId }: StateEditorProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [drafts, setDrafts]   = useState<string[]>([])

  useEffect(() => {
    setLoading(true)
    getStateData(nodeId)
      .then(d => { setDrafts(d.assignments.map(a => a.expression)) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [nodeId])

  async function save(newDrafts: string[]) {
    setSaving(true); setError(null)
    const reqs: AssignmentRequest[] = newDrafts.map(e => ({ expression: e }))
    try {
      const result = await saveAssignments(nodeId, reqs)
      setDrafts(result.assignments.map(a => a.expression))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function addAssignment() {
    const next = [...drafts, '#VAR = #VAR + 1']
    setDrafts(next)
    save(next)
  }

  function removeAssignment(i: number) {
    const next = drafts.filter((_, idx) => idx !== i)
    setDrafts(next)
    save(next)
  }

  function moveAssignment(i: number, dir: -1 | 1) {
    const next = [...drafts]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    setDrafts(next)
    save(next)
  }

  function updateDraft(i: number, val: string) {
    const next = [...drafts]
    next[i] = val
    setDrafts(next)
  }

  if (loading) return <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">Loading…</div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {error && <div className="mx-3 my-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}

      <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/50 flex items-center justify-between">
        <span>{drafts.length} assignment{drafts.length !== 1 ? 's' : ''}</span>
        {saving && <span className="text-muted-foreground">Saving…</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {drafts.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No assignments. State nodes execute SpEL assignments in order, then follow their single outgoing edge.
          </p>
        )}

        {drafts.map((expr, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>#{i + 1}</span>
              <div className="ml-auto flex items-center gap-0.5">
                <button onClick={() => moveAssignment(i, -1)} disabled={i === 0}              className="w-5 h-5 hover:text-foreground disabled:opacity-30 flex items-center justify-center">↑</button>
                <button onClick={() => moveAssignment(i, 1)}  disabled={i === drafts.length - 1} className="w-5 h-5 hover:text-foreground disabled:opacity-30 flex items-center justify-center">↓</button>
                <button onClick={() => removeAssignment(i)}   className="w-5 h-5 hover:text-red-400 flex items-center justify-center">×</button>
              </div>
            </div>
            <SpelInput
              value={expr}
              onChange={v => updateDraft(i, v)}
              onBlur={() => save(drafts)}
              mode="assignment"
              placeholder="#SCORE = #SCORE + 1"
            />
          </div>
        ))}

        <button
          onClick={addAssignment}
          className="mt-1 px-4 py-2 text-xs rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
        >
          + Add assignment
        </button>
      </div>
    </div>
  )
}
