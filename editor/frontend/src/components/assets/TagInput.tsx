import { useState, useRef, useEffect } from 'react'

interface TagInputProps {
  allTags: string[]
  existingTags: string[]
  onAdd: (tag: string) => void
}

export default function TagInput({ allTags, existingTags, onAdd }: TagInputProps) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const suggestions = allTags.filter(
    (t) => t.includes(value.toLowerCase().trim()) && !existingTags.includes(t)
  )

  function commit(tag: string) {
    const normalised = tag.trim().toLowerCase()
    if (!normalised) return
    onAdd(normalised)
    setValue('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(value)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder="Add tag…"
        onChange={(e) => { setValue(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="input-base text-xs py-1"
      />
      {open && (value || suggestions.length > 0) && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          {suggestions.length > 0 ? (
            suggestions.slice(0, 8).map((t) => (
              <button
                key={t}
                onMouseDown={(e) => { e.preventDefault(); commit(t) }}
                className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
              >
                {t}
              </button>
            ))
          ) : value.trim() ? (
            <button
              onMouseDown={(e) => { e.preventDefault(); commit(value) }}
              className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
            >
              Create tag "<span className="text-foreground">{value.trim().toLowerCase()}</span>"
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
