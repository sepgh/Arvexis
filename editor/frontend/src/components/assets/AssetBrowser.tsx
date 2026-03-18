import { useState, useEffect, useCallback, useRef } from 'react'
import type { Asset, ScanResult } from '@/types'
import { listAssets, scanAssets, listTags, uploadAsset, createFolder, listFolders } from '@/api/assets'
import AssetDetail from './AssetDetail'

type MediaFilter = 'all' | 'video' | 'audio'

export default function AssetBrowser() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [tagFilter, setTagFilter] = useState('')
  const [selected, setSelected]       = useState<Asset | null>(null)
  const [folders, setFolders]           = useState<string[]>([])
  const [uploading, setUploading]       = useState(false)
  const [uploadFolder, setUploadFolder] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [showFolderInput, setShowFolderInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [fetched, tags, fols] = await Promise.all([listAssets(), listTags(), listFolders()])
      setAssets(fetched)
      setAllTags(tags)
      setFolders(fols)
      if (selected) {
        const refreshed = fetched.find((a) => a.id === selected.id)
        setSelected(refreshed ?? null)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }, [selected])

  useEffect(() => { load() }, [])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        await uploadAsset(file, uploadFolder || undefined)
      }
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    setError(null)
    try {
      await createFolder(newFolderName.trim())
      setNewFolderName('')
      setShowFolderInput(false)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create folder')
    }
  }

  async function handleScan() {
    setScanning(true)
    setScanResult(null)
    setError(null)
    try {
      const result = await scanAssets()
      setScanResult(result)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  function handleAssetUpdated(updated: Asset) {
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    setSelected(updated)
  }

  // Filter assets client-side by search, media type, and tag
  const filtered = assets.filter((a) => {
    if (mediaFilter !== 'all' && a.mediaType !== mediaFilter) return false
    if (tagFilter && !a.tags.includes(tagFilter.toLowerCase())) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        a.fileName.toLowerCase().includes(q) ||
        a.directory.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q))
      )
    }
    return true
  })

  // Group by directory
  const directories = [...new Set(filtered.map((a) => a.directory))].sort()

  return (
    <div className="flex h-full overflow-hidden">
      {/* Panel */}
      <div className="flex flex-col w-full shrink-0 border-r border-border bg-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col border-b border-border shrink-0" style={{ padding: '16px 16px', gap: 10 }}>
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets…"
            className="input-base text-sm py-2"
          />

          {/* Media type filter + Scan */}
          <div className="flex items-center gap-1">
            <div className="flex rounded-md overflow-hidden border border-border text-sm flex-1">
              {(['all', 'video', 'audio'] as MediaFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setMediaFilter(f)}
                  className={[
                    'flex-1 capitalize transition-colors',
                    mediaFilter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={handleScan}
              disabled={scanning}
              title="Scan assets directory"
              className="flex items-center justify-center w-9 h-9 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 transition-colors shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={scanning ? 'animate-spin' : ''}>
                <path d="M6.5 1.5A5 5 0 1 1 2 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tagFilter && (
                <button
                  onClick={() => setTagFilter('')}
                  className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 flex items-center gap-1"
                >
                  {tagFilter} <span>×</span>
                </button>
              )}
              {allTags
                .filter((t) => t !== tagFilter)
                .slice(0, 8)
                .map((t) => (
                  <button
                    key={t}
                    onClick={() => setTagFilter(t)}
                    className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Upload bar */}
        <div className="px-4 py-3 border-b border-border/50 flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <select
              value={uploadFolder}
              onChange={e => setUploadFolder(e.target.value)}
              className="input-base text-sm py-1.5 flex-1 min-w-0"
            >
              <option value="">(root folder)</option>
              {folders.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload media files"
              className="flex items-center justify-center gap-1.5 h-9 px-3 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 transition-colors shrink-0"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v7M3 4l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 9.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button
              onClick={() => setShowFolderInput(v => !v)}
              title="New folder"
              className="flex items-center justify-center w-9 h-9 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 3.5h4l1.5-1.5H11v7H1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M6 6v3M4.5 7.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          {showFolderInput && (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowFolderInput(false); setNewFolderName('') } }}
                placeholder="New folder name…"
                className="input-base text-sm py-1.5 flex-1"
              />
              <button onClick={handleCreateFolder} className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90">Create</button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,audio/*,.mp4,.mov,.avi,.mkv,.webm,.mp3,.wav,.aac,.flac,.ogg"
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
        </div>

        {/* Scan result toast */}
        {scanResult && (
          <div className="mx-3 mt-2 text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 shrink-0">
            +{scanResult.added} added · ~{scanResult.updated} updated · -{scanResult.removed} removed · {scanResult.total} total
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-3 mt-2 text-xs text-destructive-foreground bg-destructive rounded-md px-3 py-2 shrink-0">
            {error}
          </div>
        )}

        {/* Asset list */}
        <div className="flex-1 overflow-y-auto">
          {loading && !assets.length ? (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-xs text-muted-foreground px-4 text-center">
              {assets.length === 0
                ? <>No assets indexed yet.<br />Click scan (↺) to index the assets directory.</>
                : 'No assets match the current filter.'}
            </div>
          ) : (
            directories.map((dir) => {
              const dirAssets = filtered.filter((a) => a.directory === dir)
              if (!dirAssets.length) return null
              return (
                <div key={dir}>
                  {/* Directory header */}
                  <div className="sticky top-0 px-3 py-1 bg-card/95 backdrop-blur text-xs text-muted-foreground font-medium border-b border-border/50">
                    {dir || '(root)'}
                  </div>
                  {dirAssets.map((asset) => (
                    <AssetRow
                      key={asset.id}
                      asset={asset}
                      selected={selected?.id === asset.id}
                      onClick={() => setSelected(selected?.id === asset.id ? null : asset)}
                    />
                  ))}
                </div>
              )
            })
          )}
        </div>

        {/* Footer count */}
        <div className="px-4 py-2.5 border-t border-border text-sm text-muted-foreground shrink-0">
          {filtered.length} / {assets.length} assets
        </div>
      </div>

      {/* Detail pane */}
      {selected && (
        <AssetDetail
          asset={selected}
          allTags={allTags}
          onClose={() => setSelected(null)}
          onAssetUpdated={handleAssetUpdated}
        />
      )}
    </div>
  )
}

function AssetRow({
  asset,
  selected,
  onClick,
}: {
  asset: Asset
  selected: boolean
  onClick: () => void
}) {
  const isVideo = asset.mediaType === 'video'

  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-border/30',
        selected ? 'bg-primary/10' : 'hover:bg-accent',
      ].join(' ')}
    >
      {/* Type icon */}
      <div className={[
        'w-8 h-8 rounded shrink-0 flex items-center justify-center',
        isVideo ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400',
      ].join(' ')}>
        {isVideo ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="3" width="9" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M10 5.5l3-2v7l-3-2v-3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="4" cy="10" r="2" stroke="currentColor" strokeWidth="1.2"/>
            <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
            <line x1="6" y1="10" x2="6" y2="3" stroke="currentColor" strokeWidth="1.2"/>
            <line x1="12" y1="8" x2="12" y2="1" stroke="currentColor" strokeWidth="1.2"/>
            <line x1="6" y1="3" x2="12" y2="1" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-foreground truncate">{asset.fileName}</span>
          {isVideo && asset.hasAlpha && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
              α
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {asset.duration != null && (
            <span className="text-xs text-muted-foreground">
              {formatDurationShort(asset.duration)}
            </span>
          )}
          {asset.resolution && (
            <span className="text-xs text-muted-foreground">{asset.resolution}</span>
          )}
          {asset.tags.length > 0 && (
            <span className="text-xs text-muted-foreground truncate">
              {asset.tags.join(', ')}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function formatDurationShort(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
