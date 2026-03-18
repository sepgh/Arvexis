import { useState, useRef, useEffect, useCallback } from 'react'
import { validateSpel } from '@/api/nodeEditor'

interface SpelInputProps {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  mode: 'assignment' | 'boolean'
  placeholder?: string
  className?: string
}

// Regex patterns for SpEL syntax highlighting
const TOKEN_RE = /(\#[A-Z_][A-Z0-9_]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([-+]?\d+\.?\d*)|([=!<>+\-*\/&|!]+)|(true|false|null)/g

function highlight(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(TOKEN_RE, (m, variable, string, number, operator, keyword) => {
      if (variable) return `<span style="color:#67e8f9">${m}</span>`
      if (string)   return `<span style="color:#fde68a">${m}</span>`
      if (number)   return `<span style="color:#86efac">${m}</span>`
      if (operator) return `<span style="color:#fca5a5">${m}</span>`
      if (keyword)  return `<span style="color:#c4b5fd">${m}</span>`
      return m
    })
}

let debounceTimer: ReturnType<typeof setTimeout>

export default function SpelInput({ value, onChange, onBlur, mode, placeholder, className }: SpelInputProps) {
  const [validState, setValidState] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef  = useRef<HTMLDivElement>(null)

  function syncScroll() {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop  = textareaRef.current.scrollTop
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  const runValidation = useCallback(async (expr: string) => {
    if (!expr.trim()) { setValidState('idle'); setErrorMsg(null); return }
    try {
      const result = await validateSpel(expr, mode)
      setValidState(result.valid ? 'valid' : 'invalid')
      setErrorMsg(result.valid ? null : result.error)
    } catch { /* ignore */ }
  }, [mode])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value)
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => runValidation(e.target.value), 500)
  }

  function handleBlur() {
    runValidation(value)
    onBlur?.()
  }

  useEffect(() => { syncScroll() }, [value])

  const borderColor = validState === 'valid'
    ? 'border-emerald-500/60'
    : validState === 'invalid'
    ? 'border-red-500/60'
    : 'border-border'

  return (
    <div className={['flex flex-col gap-1', className].join(' ')}>
      <div className={`relative rounded-lg border bg-muted/30 ${borderColor} overflow-hidden`}>
        {/* Highlight overlay */}
        <div
          ref={overlayRef}
          aria-hidden
          className="absolute inset-0 font-mono whitespace-pre-wrap break-words pointer-events-none overflow-hidden"
          dangerouslySetInnerHTML={{ __html: highlight(value) + '\u200b' }}
          style={{ color: 'transparent', padding: '10px 14px', fontSize: 14 }}
        />
        {/* Actual textarea — caret visible, text transparent */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onScroll={syncScroll}
          placeholder={placeholder}
          rows={2}
          spellCheck={false}
          className="relative w-full font-mono bg-transparent resize-y outline-none"
          style={{ caretColor: 'white', color: 'transparent', padding: '10px 14px', fontSize: 14, minHeight: 56 }}
        />
        {/* Visible text layer — same position as textarea */}
        <div
          aria-hidden
          className="absolute inset-0 font-mono whitespace-pre-wrap break-words pointer-events-none overflow-hidden"
          dangerouslySetInnerHTML={{ __html: highlight(value) + '\u200b' }}
          style={{ padding: '10px 14px', fontSize: 14 }}
        />
      </div>
      {validState === 'invalid' && errorMsg && (
        <p className="text-[10px] text-red-400 leading-snug px-1">{errorMsg}</p>
      )}
    </div>
  )
}
