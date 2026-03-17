import type { Asset } from '@/types'
import { addTag, removeTag } from '@/api/assets'
import TagInput from './TagInput'

interface AssetDetailProps {
  asset: Asset
  allTags: string[]
  onClose: () => void
  onAssetUpdated: (asset: Asset) => void
}

export default function AssetDetail({ asset, allTags, onClose, onAssetUpdated }: AssetDetailProps) {
  async function handleAddTag(tag: string) {
    try {
      const updated = await addTag(asset.id, tag)
      onAssetUpdated(updated)
    } catch { /* ignore */ }
  }

  async function handleRemoveTag(tag: string) {
    try {
      await removeTag(asset.id, tag)
      onAssetUpdated({ ...asset, tags: asset.tags.filter((t) => t !== tag) })
    } catch { /* ignore */ }
  }

  const isVideo = asset.mediaType === 'video'

  return (
    <div className="flex flex-col h-full bg-card border-l border-border w-72 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-medium text-foreground truncate pr-2" title={asset.fileName}>
          {asset.fileName}
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground shrink-0 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Type + Alpha badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={[
            'text-xs px-2 py-0.5 rounded-full font-medium',
            isVideo
              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
              : 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
          ].join(' ')}>
            {isVideo ? 'Video' : 'Audio'}
          </span>
          {isVideo && asset.hasAlpha && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Alpha
            </span>
          )}
        </div>

        {/* Metadata table */}
        <div className="flex flex-col gap-1.5">
          <MetaRow label="Codec" value={asset.codec} />
          {isVideo && <MetaRow label="Resolution" value={asset.resolution} />}
          {isVideo && <MetaRow label="Frame rate" value={asset.frameRate != null ? `${asset.frameRate} fps` : null} />}
          <MetaRow label="Duration" value={asset.duration != null ? formatDuration(asset.duration) : null} />
          <MetaRow label="Size" value={asset.fileSize != null ? formatSize(asset.fileSize) : null} />
          <MetaRow label="Directory" value={asset.directory || '(root)'} />
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags</span>
          {asset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {asset.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full text-foreground"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-muted-foreground hover:text-foreground leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <TagInput
            allTags={allTags}
            existingTags={asset.tags}
            onAdd={handleAddTag}
          />
        </div>

        {/* Full path */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Path</span>
          <p className="text-xs text-muted-foreground font-mono break-all leading-relaxed">
            {asset.filePath}
          </p>
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-foreground text-right truncate">{value}</span>
    </div>
  )
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = (secs % 60).toFixed(2)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${s.padStart(5, '0')}`
  return `${m}:${s.padStart(5, '0')}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
