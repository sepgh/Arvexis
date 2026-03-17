import { ArrowRight, Clock } from 'lucide-react';
import type { AppEdge } from '../../types';

interface TransitionPanelProps {
  edge: AppEdge;
}

const TRANSITION_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'fade-in', label: 'Fade In' },
  { value: 'fade-out', label: 'Fade Out' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'cut', label: 'Cut' },
  { value: 'video', label: 'Video' },
];

export default function TransitionPanel({ edge }: TransitionPanelProps) {
  const transition = edge.data?.transition;

  return (
    <div className="space-y-5">
      {/* Edge info */}
      <div className="flex items-center gap-2.5 rounded-lg bg-[#252630] px-4 py-3 text-sm text-slate-400">
        <span className="text-slate-200 font-medium">{edge.source}</span>
        <ArrowRight size={14} />
        <span className="text-slate-200 font-medium">{edge.target}</span>
      </div>

      {edge.data?.label && (
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-400">Edge Label</label>
          <input
            type="text"
            value={edge.data.label}
            readOnly
            className="w-full rounded-lg border border-[#2e303a] bg-[#252630] px-3.5 py-2 text-sm text-slate-200"
          />
        </div>
      )}

      {/* Transition type */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-400">Transition Type</label>
        <div className="grid grid-cols-2 gap-2">
          {TRANSITION_TYPES.map((t) => (
            <div
              key={t.value}
              className={`rounded-lg border px-3.5 py-2.5 text-center text-sm cursor-pointer transition ${
                transition?.type === t.value
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                  : 'border-[#2e303a] text-slate-500 hover:border-slate-600 hover:text-slate-400'
              }`}
            >
              {t.label}
            </div>
          ))}
        </div>
      </div>

      {/* Duration */}
      {transition && transition.type !== 'none' && (
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-400">
            <Clock size={16} />
            Duration
          </label>
          <div className="flex items-center gap-2.5">
            <input
              type="number"
              value={transition.duration ?? 1}
              readOnly
              className="w-24 rounded-lg border border-[#2e303a] bg-[#252630] px-3.5 py-2 text-sm text-slate-200 font-mono"
              step={0.5}
              min={0.5}
              max={5}
            />
            <span className="text-sm text-slate-500">seconds (max 5s)</span>
          </div>
          {(transition.duration ?? 0) > 5 && (
            <div className="mt-1.5 text-xs text-red-400">Duration exceeds 5s limit</div>
          )}
        </div>
      )}
    </div>
  );
}
