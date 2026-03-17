import { useState, useEffect } from 'react'
import type { ValidationReport, ValidationIssue } from '@/types'
import { validateGraph } from '@/api/validation'
import { useEditorStore } from '@/store'

export default function ValidationPanel() {
  const [report, setReport]   = useState<ValidationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const setSelectedNodeId = useEditorStore(s => s.setSelectedNodeId)
  const setSelectedEdgeId = useEditorStore(s => s.setSelectedEdgeId)
  const toggleValidationPanel = useEditorStore(s => s.toggleValidationPanel)

  useEffect(() => {
    run()
  }, [])

  async function run() {
    setLoading(true); setError(null)
    try {
      setReport(await validateGraph())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setLoading(false)
    }
  }

  function handleIssueClick(issue: ValidationIssue) {
    if (issue.nodeId) setSelectedNodeId(issue.nodeId)
    else if (issue.edgeId) setSelectedEdgeId(issue.edgeId)
  }

  const totalErrors   = report?.errors.length   ?? 0
  const totalWarnings = report?.warnings.length  ?? 0

  return (
    <div className="flex flex-col w-80 shrink-0 border-l border-border bg-card overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Graph</span>
          <p className="text-sm font-medium text-foreground mt-0.5">Validation</p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          {loading ? '…' : '↻ Run'}
        </button>
        <button
          onClick={toggleValidationPanel}
          className="text-muted-foreground hover:text-foreground text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Summary bar */}
      {report && (
        <div className="flex border-b border-border shrink-0">
          <div className={`flex-1 py-2 text-center text-xs font-medium ${totalErrors > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
            {totalErrors} error{totalErrors !== 1 ? 's' : ''}
          </div>
          <div className="w-px bg-border" />
          <div className={`flex-1 py-2 text-center text-xs font-medium ${totalWarnings > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>
            {totalWarnings} warning{totalWarnings !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-3 my-3 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">Running…</div>
        )}

        {report && !loading && (
          <>
            {totalErrors === 0 && totalWarnings === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <span className="text-2xl">✅</span>
                <p className="text-sm font-medium text-foreground">Graph is valid</p>
                <p className="text-xs text-muted-foreground">No errors or warnings found.</p>
              </div>
            )}

            {report.errors.length > 0 && (
              <IssueGroup
                title="Errors"
                issues={report.errors}
                color="red"
                onIssueClick={handleIssueClick}
              />
            )}

            {report.warnings.length > 0 && (
              <IssueGroup
                title="Warnings"
                issues={report.warnings}
                color="amber"
                onIssueClick={handleIssueClick}
              />
            )}
          </>
        )}

        {!report && !loading && !error && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Click Run to validate the graph.
          </div>
        )}
      </div>
    </div>
  )
}

function IssueGroup({ title, issues, color, onIssueClick }: {
  title: string
  issues: ValidationIssue[]
  color: 'red' | 'amber'
  onIssueClick: (issue: ValidationIssue) => void
}) {
  const colorMap = {
    red:   { heading: 'text-red-400',   item: 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10',   dot: 'bg-red-400' },
    amber: { heading: 'text-amber-400', item: 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10', dot: 'bg-amber-400' },
  }
  const c = colorMap[color]
  const clickable = (issue: ValidationIssue) => !!(issue.nodeId || issue.edgeId)

  return (
    <div className="px-3 py-3 flex flex-col gap-2">
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${c.heading}`}>{title}</p>
      {issues.map((issue, i) => (
        <button
          key={i}
          onClick={() => clickable(issue) && onIssueClick(issue)}
          disabled={!clickable(issue)}
          className={[
            'w-full text-left rounded-lg border p-2.5 flex items-start gap-2.5 transition-colors',
            c.item,
            !clickable(issue) ? 'cursor-default' : 'cursor-pointer',
          ].join(' ')}
        >
          <span className={`w-2 h-2 rounded-full ${c.dot} mt-0.5 shrink-0`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground leading-snug">{issue.message}</p>
            {clickable(issue) && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Click to highlight →</p>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
