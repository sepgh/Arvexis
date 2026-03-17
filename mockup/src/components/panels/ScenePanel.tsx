import { Film, Play, Music, Flag, FlagTriangleRight, Clock, Layers } from 'lucide-react';
import type { SceneNodeData } from '../../types';

interface ScenePanelProps {
  data: SceneNodeData;
}

export default function ScenePanel({ data }: ScenePanelProps) {
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="divide-y divide-[#2e303a]">
      {/* Flags */}
      <div className="flex gap-2 pb-5">
        <label className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm cursor-pointer transition ${
          data.isRoot ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-[#2e303a] text-slate-500 hover:border-slate-600'
        }`}>
          <FlagTriangleRight size={16} />
          Root Node
          <input type="checkbox" checked={data.isRoot} readOnly className="sr-only" />
          <div className={`ml-auto h-5 w-8 rounded-full transition ${data.isRoot ? 'bg-emerald-500' : 'bg-slate-700'}`}>
            <div className={`h-5 w-5 rounded-full bg-white shadow transition ${data.isRoot ? 'translate-x-3' : 'translate-x-0'}`} />
          </div>
        </label>
        <label className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm cursor-pointer transition ${
          data.isEnd ? 'border-red-500/50 bg-red-500/10 text-red-300' : 'border-[#2e303a] text-slate-500 hover:border-slate-600'
        }`}>
          <Flag size={16} />
          End Node
          <input type="checkbox" checked={data.isEnd} readOnly className="sr-only" />
          <div className={`ml-auto h-5 w-8 rounded-full transition ${data.isEnd ? 'bg-red-500' : 'bg-slate-700'}`}>
            <div className={`h-5 w-5 rounded-full bg-white shadow transition ${data.isEnd ? 'translate-x-3' : 'translate-x-0'}`} />
          </div>
        </label>
      </div>

      {/* Duration */}
      <div className="py-5">
      <div className="flex items-center gap-2.5 rounded-lg bg-[#252630] px-4 py-3">
        <Clock size={16} className="text-slate-400" />
        <span className="text-sm text-slate-400">Duration</span>
        <span className="ml-auto text-base font-mono font-medium text-slate-200">{formatDuration(data.duration)}</span>
      </div>
      </div>

      {/* Background Color */}
      <div className="py-5">
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-400">
          Background Color
        </label>
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-lg border border-white/10 cursor-pointer shrink-0"
            style={{ backgroundColor: data.backgroundColor }}
          />
          <input
            type="text"
            value={data.backgroundColor}
            readOnly
            className="flex-1 rounded-lg border border-[#2e303a] bg-[#252630] px-3.5 py-2 text-sm text-slate-200 font-mono"
          />
        </div>
      </div>

      {/* Video Layers */}
      <div className="py-5">
        <div className="mb-2.5 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-400">
            <Layers size={16} />
            Video Layers
          </label>
          <button className="rounded-md bg-blue-500/20 px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/30 transition">
            + Add Layer
          </button>
        </div>
        <div className="space-y-2">
          {data.videoLayers.map((layer, i) => (
            <div
              key={layer.id}
              className="flex items-center gap-2.5 rounded-lg border border-[#2e303a] bg-[#252630] px-3.5 py-2.5"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/20 text-xs font-bold text-blue-400">
                {i + 1}
              </div>
              <Film size={14} className="text-slate-400" />
              <span className="flex-1 truncate text-sm text-slate-200">{layer.assetName}</span>
              {layer.hasAlpha && (
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  ALPHA
                </span>
              )}
              <span className="text-xs text-slate-500 font-mono">
                @{layer.startAt}s
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Audio Tracks */}
      <div className="py-5">
        <div className="mb-2.5 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-400">
            <Music size={16} />
            Audio Tracks
          </label>
          <button className="rounded-md bg-blue-500/20 px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/30 transition">
            + Add Track
          </button>
        </div>
        <div className="space-y-2">
          {data.audioTracks.map((track, i) => (
            <div
              key={track.id}
              className="flex items-center gap-2.5 rounded-lg border border-[#2e303a] bg-[#252630] px-3.5 py-2.5"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500/20 text-xs font-bold text-green-400">
                {i + 1}
              </div>
              <Music size={14} className="text-slate-400" />
              <span className="flex-1 truncate text-sm text-slate-200">{track.assetName}</span>
              <span className="text-xs text-slate-500 font-mono">
                @{track.startAt}s
              </span>
            </div>
          ))}
          {data.audioTracks.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#2e303a] px-3.5 py-4 text-center text-xs text-slate-600">
              No audio tracks
            </div>
          )}
        </div>
      </div>

      {/* Decisions */}
      <div className="py-5">
        <div className="mb-2.5 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-400">
            <Play size={16} />
            Decisions
          </label>
          <button className="rounded-md bg-blue-500/20 px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/30 transition">
            + Add Decision
          </button>
        </div>
        {data.decisions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#2e303a] px-3.5 py-4 text-center text-xs text-slate-600">
            No decisions — auto CONTINUE
          </div>
        ) : (
          <div className="space-y-2">
            {data.decisions.map((dec) => (
              <div
                key={dec.key}
                className="flex items-center gap-2.5 rounded-lg border border-[#2e303a] bg-[#252630] px-3.5 py-2.5"
              >
                <span className="flex-1 text-sm font-mono text-slate-200">{dec.key}</span>
                {dec.isDefault && (
                  <span className="rounded-md bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                    DEFAULT
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision Appearance */}
      <div className="py-5">
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-400">
          <Clock size={16} />
          Button Appearance
        </label>
        <div className="flex gap-2">
          <div className={`flex-1 rounded-lg border px-3.5 py-2.5 text-center text-sm cursor-pointer transition ${
            data.decisionAppearance.timing === 'after-video'
              ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
              : 'border-[#2e303a] text-slate-500 hover:border-slate-600'
          }`}>
            After Video
          </div>
          <div className={`flex-1 rounded-lg border px-3.5 py-2.5 text-center text-sm cursor-pointer transition ${
            data.decisionAppearance.timing === 'at-timestamp'
              ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
              : 'border-[#2e303a] text-slate-500 hover:border-slate-600'
          }`}>
            At Timestamp
          </div>
        </div>
        {data.decisionAppearance.timing === 'at-timestamp' && data.decisionAppearance.timestamp !== undefined && (
          <div className="mt-2.5 flex items-center gap-2.5">
            <span className="text-xs text-slate-500">Show at:</span>
            <input
              type="text"
              value={`${data.decisionAppearance.timestamp}s`}
              readOnly
              className="w-20 rounded-lg border border-[#2e303a] bg-[#252630] px-3 py-1.5 text-sm font-mono text-slate-200 text-center"
            />
          </div>
        )}
      </div>

      {/* Preview button */}
      <div className="pt-5">
        <button className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 transition">
          <Play size={18} />
          Preview Scene
        </button>
      </div>
    </div>
  );
}
