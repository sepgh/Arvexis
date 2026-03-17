import { GitBranch, Plus, GripVertical, Trash2 } from 'lucide-react';
import type { DecisionNodeData } from '../../types';

interface DecisionPanelProps {
  data: DecisionNodeData;
}

export default function DecisionPanel({ data }: DecisionPanelProps) {
  return (
    <div className="divide-y divide-[#2e303a]">
      {/* Info */}
      <div className="pb-5">
        <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 px-4 py-3 text-xs leading-relaxed text-violet-200/70">
        Conditions are evaluated in order. The first match wins. The <strong>else</strong> condition is always last and acts as a fallback.
        </div>
      </div>

      {/* Conditions */}
      <div className="py-5">
        <div className="mb-2.5 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-400">
            <GitBranch size={16} />
            Conditions
          </label>
          <button className="flex items-center gap-1.5 rounded-md bg-violet-500/20 px-2.5 py-1 text-xs font-medium text-violet-300 hover:bg-violet-500/30 transition">
            <Plus size={12} />
            Add Condition
          </button>
        </div>
        <div className="space-y-2">
          {data.conditions.map((cond, i) => (
            <div
              key={cond.id}
              className={`group flex items-center gap-2.5 rounded-lg border px-3 py-2.5 ${
                cond.isElse
                  ? 'border-violet-500/30 bg-violet-500/5'
                  : 'border-[#2e303a] bg-[#252630]'
              }`}
            >
              {!cond.isElse && (
                <GripVertical size={14} className="text-slate-600 cursor-grab shrink-0" />
              )}
              <div className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold shrink-0 ${
                cond.isElse ? 'bg-violet-500/20 text-violet-300' : 'bg-violet-500/20 text-violet-400'
              }`}>
                {cond.isElse ? '*' : i + 1}
              </div>
              {cond.isElse ? (
                <span className="flex-1 text-sm font-medium text-violet-300 italic">
                  else (fallback)
                </span>
              ) : (
                <input
                  type="text"
                  value={cond.expression}
                  readOnly
                  className="flex-1 bg-transparent text-sm font-mono text-violet-200/80 outline-none min-w-0"
                />
              )}
              <div className="flex items-center gap-1.5">
                {!cond.isElse && (
                  <>
                    <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      VALID
                    </span>
                    <button className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition p-1">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edge mapping */}
      <div className="py-5">
        <label className="mb-2 block text-sm font-medium text-slate-500">Edge Mapping</label>
        <div className="rounded-lg border border-[#2e303a] bg-[#252630] p-4 space-y-2.5">
          {data.conditions.map((cond, i) => (
            <div key={cond.id} className="flex items-center gap-2.5 text-xs">
              <span className={`shrink-0 font-mono ${cond.isElse ? 'text-violet-300 italic' : 'text-violet-200/80'}`}>
                {cond.isElse ? 'else' : `Cond ${i + 1}`}
              </span>
              <div className="flex-1 border-b border-dotted border-slate-700" />
              <span className="shrink-0 text-slate-500">
                {cond.isElse ? 'Bad Ending' : i === 0 ? 'Good Ending' : 'Good Ending'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SpEL reference */}
      <div className="py-5">
        <label className="mb-2 text-sm font-medium text-slate-500">SpEL Quick Reference</label>
        <div className="rounded-lg border border-[#2e303a] bg-[#252630] p-4 space-y-1.5 text-xs font-mono text-slate-400">
          <div><span className="text-violet-300">#VAR</span> {'>'} 10</div>
          <div><span className="text-violet-300">#A</span> == <span className="text-emerald-300">true</span> <span className="text-slate-500">and</span> <span className="text-violet-300">#B</span> {'>'} 5</div>
          <div>(<span className="text-violet-300">#X</span> != 0) <span className="text-slate-500">or</span> <span className="text-violet-300">#Y</span> {'<'}= 100</div>
          <div className="pt-1.5 text-slate-600">Operators: == != {'<'} {'>'} {'<'}= {'>'}= and or not</div>
        </div>
      </div>
    </div>
  );
}
