import { useEditorStore } from '@/store'

export default function SaveIndicator() {
  const saveStatus = useEditorStore(s => s.saveStatus)
  const saveError  = useEditorStore(s => s.saveError)

  if (saveStatus === 'idle') return null

  const configs = {
    saving: {
      dot: 'bg-yellow-400 animate-pulse',
      text: 'text-muted-foreground',
      label: 'Saving…',
    },
    saved: {
      dot: 'bg-green-500',
      text: 'text-green-500',
      label: 'Saved',
    },
    error: {
      dot: 'bg-red-500',
      text: 'text-red-400',
      label: saveError ? `Error: ${saveError}` : 'Save failed',
    },
  } as const

  const c = configs[saveStatus as keyof typeof configs]
  if (!c) return null

  return (
    <div
      className={[
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
        c.text,
        saveStatus === 'error'
          ? 'bg-red-500/10 border border-red-500/20'
          : '',
      ].join(' ')}
      title={saveStatus === 'error' ? (saveError ?? 'Save failed') : undefined}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      <span className="max-w-[200px] truncate">{c.label}</span>
    </div>
  )
}
