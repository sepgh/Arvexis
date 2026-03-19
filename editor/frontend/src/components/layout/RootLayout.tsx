import { type ReactNode, useState, useEffect, useRef } from 'react'
import { useEditorStore } from '@/store'
import SaveIndicator from './SaveIndicator'
import { generateManifest, manifestDownloadUrl, startCompilation, getCompileStatus, cancelCompile, compileDownloadUrl } from '@/api/compile'
import type { PreviewJobStatus } from '@/api/preview'

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  const projectConfig = useEditorStore((s) => s.projectConfig)
  const assetPanelOpen = useEditorStore((s) => s.assetPanelOpen)
  const toggleAssetPanel = useEditorStore((s) => s.toggleAssetPanel)
  const validationPanelOpen    = useEditorStore((s) => s.validationPanelOpen)
  const toggleValidationPanel   = useEditorStore((s) => s.toggleValidationPanel)
  const localizationPanelOpen   = useEditorStore((s) => s.localizationPanelOpen)
  const toggleLocalizationPanel = useEditorStore((s) => s.toggleLocalizationPanel)
  const projectSettingsPanelOpen = useEditorStore((s) => s.projectSettingsPanelOpen)
  const toggleProjectSettingsPanel = useEditorStore((s) => s.toggleProjectSettingsPanel)
  const [manifestGenerating, setManifestGenerating] = useState(false)
  const [manifestReady, setManifestReady] = useState(false)
  const [manifestError, setManifestError] = useState<string | null>(null)

  const [compileJob, setCompileJob] = useState<PreviewJobStatus | null>(null)
  const compileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Poll compile status
  useEffect(() => {
    if (!compileJob) return
    const terminal = ['done', 'failed', 'cancelled']
    if (terminal.includes(compileJob.status)) {
      if (compileTimerRef.current) clearTimeout(compileTimerRef.current)
      return
    }
    compileTimerRef.current = setTimeout(async () => {
      try {
        const updated = await getCompileStatus(compileJob.jobId)
        setCompileJob(updated)
      } catch { /* ignore */ }
    }, 800)
    return () => { if (compileTimerRef.current) clearTimeout(compileTimerRef.current) }
  }, [compileJob])

  async function handleCompile() {
    try {
      const result = await startCompilation()
      setCompileJob({ jobId: result.jobId, type: 'compile', status: 'pending',
        progress: 0, statusText: 'Starting…', error: '', fileUrl: '' })
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Compilation failed to start')
    }
  }

  async function handleCancelCompile() {
    if (!compileJob) return
    try { await cancelCompile(compileJob.jobId) } catch { /* best-effort */ }
    setCompileJob(prev => prev ? { ...prev, status: 'cancelled' } : null)
  }

  const compileActive = compileJob?.status === 'pending' || compileJob?.status === 'running'
  const compileDone   = compileJob?.status === 'done'
  const compileFailed = compileJob?.status === 'failed'
  const compilePct    = compileJob?.progress ?? 0
  const compileText   = compileJob?.statusText ?? ''

  async function handleGenerateManifest() {
    setManifestGenerating(true)
    setManifestError(null)
    try {
      await generateManifest()
      setManifestReady(true)
      setTimeout(() => setManifestReady(false), 8000)
    } catch (e: unknown) {
      setManifestError(e instanceof Error ? e.message : 'Failed')
      setTimeout(() => setManifestError(null), 5000)
    } finally {
      setManifestGenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between bg-card border-b border-border shrink-0" style={{ height: 56, paddingLeft: 28, paddingRight: 28 }}>
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Arvexis" className="h-7 w-auto" />
          <span className="font-semibold text-foreground tracking-wide" style={{ fontSize: 18 }}>
            Arvexis
          </span>
          {projectConfig && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground" style={{ fontSize: 18 }}>{projectConfig.name}</span>
            </>
          )}
        </div>

        {projectConfig && (
          <div className="flex items-center" style={{ gap: 10 }}>
            <SaveIndicator />
            <div className="w-px h-4 bg-border" />
            <button
              onClick={toggleAssetPanel}
              title="Toggle asset browser"
              className={[
                'flex items-center rounded-md font-medium transition-colors',
                assetPanelOpen
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent',
              ].join(' ')}
              style={{ padding: '8px 14px', fontSize: 14, gap: 7 }}
            >
              {/* Film strip icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <rect x="1" y="4" width="2" height="2" fill="currentColor" rx="0.3"/>
                <rect x="1" y="8" width="2" height="2" fill="currentColor" rx="0.3"/>
                <rect x="11" y="4" width="2" height="2" fill="currentColor" rx="0.3"/>
                <rect x="11" y="8" width="2" height="2" fill="currentColor" rx="0.3"/>
                <line x1="4" y1="2" x2="4" y2="12" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="10" y1="2" x2="10" y2="12" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              Assets
            </button>
            <button
              onClick={toggleLocalizationPanel}
              title="Localization"
              className={[
                'flex items-center rounded-md font-medium transition-colors',
                localizationPanelOpen
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent',
              ].join(' ')}
              style={{ padding: '8px 14px', fontSize: 14, gap: 7 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M7 1.5C5.5 3.5 4.5 5.2 4.5 7s1 3.5 2.5 5.5M7 1.5C8.5 3.5 9.5 5.2 9.5 7s-1 3.5-2.5 5.5M1.5 7h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Locales
            </button>
            <button
              onClick={toggleProjectSettingsPanel}
              title="Project settings"
              className={[
                'flex items-center rounded-md font-medium transition-colors',
                projectSettingsPanelOpen
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent',
              ].join(' ')}
              style={{ padding: '8px 14px', fontSize: 14, gap: 7 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5.4 1.5h3.2l.4 1.5 1.5.6 1.3-.9 2.2 2.2-.9 1.3.6 1.5 1.5.4v3.2l-1.5.4-.6 1.5.9 1.3-2.2 2.2-1.3-.9-1.5.6-.4 1.5H5.4l-.4-1.5-1.5-.6-1.3.9-2.2-2.2.9-1.3-.6-1.5L0 8.7V5.5l1.5-.4.6-1.5-.9-1.3 2.2-2.2 1.3.9 1.5-.6.4-1.5Zm1.6 3a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
              </svg>
              Project Settings
            </button>
            <button
              onClick={toggleValidationPanel}
              title="Validate graph"
              className={[
                'flex items-center rounded-md font-medium transition-colors',
                validationPanelOpen
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent',
              ].join(' ')}
              style={{ padding: '8px 14px', fontSize: 14, gap: 7 }}
            >
              {/* Checkmark shield icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5L2 3.5v3.5C2 9.8 4.2 12.1 7 12.5c2.8-.4 5-2.7 5-5.5V3.5L7 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M4.5 7l1.5 1.5L9.5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Validate
            </button>

            {/* Manifest button + download */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleGenerateManifest}
                disabled={manifestGenerating}
                title="Generate JSON manifest"
                className={[
                  'flex items-center rounded-md font-medium transition-colors',
                  manifestError
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent',
                  manifestGenerating ? 'opacity-50' : '',
                ].join(' ')}
                style={{ padding: '8px 14px', fontSize: 14, gap: 7 }}
              >
                {/* Braces icon */}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 2H3.5A1.5 1.5 0 002 3.5V5l-1 2 1 2v1.5A1.5 1.5 0 003.5 12H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 2h1.5A1.5 1.5 0 0112 3.5V5l1 2-1 2v1.5A1.5 1.5 0 0110.5 12H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {manifestGenerating ? 'Generating…' : manifestError ? `Error: ${manifestError}` : 'Manifest'}
              </button>
              {manifestReady && (
                <a
                  href={manifestDownloadUrl()}
                  download="manifest.json"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-green-400 hover:text-green-300 bg-green-500/10 border border-green-500/20 transition-colors"
                  title="Download manifest.json"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v6M3 6l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Download
                </a>
              )}
            </div>

            {/* Compile button */}
            <button
              onClick={handleCompile}
              disabled={compileActive}
              title="Compile project (scene videos + HLS)"
              className={[
                'flex items-center rounded-md font-medium transition-colors',
                compileFailed
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : compileDone
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent',
                compileActive ? 'opacity-50' : '',
              ].join(' ')}
              style={{ padding: '8px 14px', fontSize: 14, gap: 7 }}
            >
              {/* Triangle play icon */}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 1.5l8 4.5-8 4.5V1.5z" fill="currentColor"/>
              </svg>
              {compileActive ? 'Compiling…' : compileDone ? 'Compiled ✓' : compileFailed ? 'Failed' : 'Compile'}
            </button>
          </div>
        )}
      </header>

      {/* Compile progress panel */}
      {compileJob && compileJob.status !== 'cancelled' && (
        <div className="relative shrink-0 bg-card border-b border-border px-4 py-2 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground truncate max-w-[60%]">{compileText || 'Compiling…'}</span>
              <span className="text-xs tabular-nums text-muted-foreground ml-2">{compilePct}%</span>
            </div>
            <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={[
                  'absolute inset-y-0 left-0 rounded-full transition-all duration-300',
                  compileFailed ? 'bg-red-500' : 'bg-primary',
                ].join(' ')}
                style={{ width: `${compilePct}%` }}
              />
            </div>
            {compileFailed && (
              <p className="text-[10px] text-red-400 mt-0.5 truncate">{compileJob.error}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {compileActive && (
              <button
                onClick={handleCancelCompile}
                className="text-xs px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-colors"
              >
                Cancel
              </button>
            )}
            {compileDone && (
              <a
                href={compileDownloadUrl()}
                download
                className="text-xs px-2.5 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors flex items-center gap-1"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v6M3 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 10h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Download
              </a>
            )}
            {!compileActive && (
              <button
                onClick={() => setCompileJob(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
                title="Dismiss"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main area */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
