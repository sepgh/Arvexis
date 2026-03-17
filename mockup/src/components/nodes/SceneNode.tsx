import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Film, Flag, Play, FlagTriangleRight } from 'lucide-react';
import type { SceneNodeData } from '../../types';

const SceneNode = memo(({ data, selected }: NodeProps) => {
  const d = data as SceneNodeData;
  const isDefaultContinue = d.decisions.length === 0;

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`
        relative min-w-[220px] max-w-[260px] rounded-xl border bg-[#1a1b23] shadow-lg
        ${selected ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-[#2e303a]'}
        ${d.isEnd ? 'border-red-500/50' : ''}
        ${d.isRoot ? 'border-emerald-500/50' : ''}
      `}
    >
      {/* Root badge */}
      {d.isRoot && (
        <div className="absolute -top-3 left-3 flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
          <FlagTriangleRight size={12} />
          ROOT
        </div>
      )}

      {/* End badge */}
      {d.isEnd && (
        <div className="absolute -top-3 right-3 flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">
          <Flag size={12} />
          END
        </div>
      )}

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3.5 !h-3.5 !bg-blue-400 !border-2 !border-[#1a1b23]"
      />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-1.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-500/20">
          <Film size={16} className="text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-slate-100">
            {d.name}
          </div>
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-3 px-3.5 py-2 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Play size={12} />
          {formatDuration(d.duration)}
        </span>
        <span>{d.videoLayers.length} video{d.videoLayers.length !== 1 ? 's' : ''}</span>
        <span>{d.audioTracks.length} audio</span>
      </div>

      {/* Background color preview */}
      <div className="mx-3.5 mb-2.5 flex items-center gap-2 text-xs text-slate-500">
        <div
          className="h-3.5 w-3.5 rounded border border-white/10"
          style={{ backgroundColor: d.backgroundColor }}
        />
        <span>{d.backgroundColor}</span>
      </div>

      {/* Decisions / output handles */}
      {isDefaultContinue ? (
        <div className="relative border-t border-[#2e303a] px-3.5 py-2.5">
          <div className="text-xs text-slate-500 text-center">CONTINUE</div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="decision-CONTINUE"
            className="!w-3.5 !h-3.5 !bg-blue-400 !border-2 !border-[#1a1b23]"
          />
        </div>
      ) : (
        <div className="border-t border-[#2e303a]">
          {d.decisions.map((dec, i) => (
            <div
              key={dec.key}
              className={`relative flex items-center justify-between px-3.5 py-2 ${
                i < d.decisions.length - 1 ? 'border-b border-[#2e303a]/50' : ''
              }`}
            >
              <span className="text-xs text-slate-300">
                {dec.key}
              </span>
              {dec.isDefault && (
                <span className="text-[10px] rounded-md bg-blue-500/20 px-2 py-0.5 text-blue-300 font-medium">
                  DEFAULT
                </span>
              )}
              <Handle
                type="source"
                position={Position.Bottom}
                id={`decision-${dec.key}`}
                className="!w-3 !h-3 !bg-blue-400 !border-2 !border-[#1a1b23]"
                style={{ left: `${((i + 1) / (d.decisions.length + 1)) * 100}%` }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

SceneNode.displayName = 'SceneNode';
export default SceneNode;
