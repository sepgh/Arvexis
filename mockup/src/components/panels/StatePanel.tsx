import { Cog, Plus, GripVertical, Trash2 } from 'lucide-react';
import type { StateNodeData } from '../../types';

interface StatePanelProps {
  data: StateNodeData;
}

export default function StatePanel({ data }: StatePanelProps) {
  return (
    <div className="divide-y divide-[#2e303a]">
      {/* Info */}
      <div className="pb-5">
      <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-4 py-3 text-xs leading-relaxed text-amber-200/70">
        State nodes execute assignments in order and immediately continue to the next node (exactly one outgoing edge).
      </div>
      </div>

      {/* Assignments */}
      <div className="py-5">
        <div className="mb-2.5 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-400">
            <Cog size={16} />
            Assignments
          </label>
          <button className="flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition">
            <Plus size={12} />
            Add
          </button>
        </div>
        <div className="space-y-2">
          {data.assignments.map((a, i) => (
            <div
              key={a.id}
              className="group flex items-center gap-2.5 rounded-lg border border-[#2e303a] bg-[#252630] px-3 py-2.5"
            >
              <GripVertical size={14} className="text-slate-600 cursor-grab shrink-0" />
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20 text-xs font-bold text-amber-400 shrink-0">
                {i + 1}
              </div>
              <input
                type="text"
                value={a.expression}
                readOnly
                className="flex-1 bg-transparent text-sm font-mono text-amber-200/80 outline-none min-w-0"
              />
              <div className="flex items-center gap-1.5">
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  VALID
                </span>
                <button className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expression reference */}
      <div className="py-5">
        <label className="mb-2 text-sm font-medium text-slate-500">SpEL Quick Reference</label>
        <div className="rounded-lg border border-[#2e303a] bg-[#252630] p-4 space-y-1.5 text-xs font-mono text-slate-400">
          <div><span className="text-amber-300">#VAR</span> = <span className="text-amber-300">#VAR</span> + 1</div>
          <div><span className="text-amber-300">#FLAG</span> = <span className="text-emerald-300">true</span></div>
          <div><span className="text-amber-300">#NAME</span> = <span className="text-sky-300">'hello'</span> + <span className="text-sky-300">' world'</span></div>
          <div className="pt-1.5 text-slate-600">Operators: + - * / % and or not</div>
        </div>
      </div>
    </div>
  );
}
