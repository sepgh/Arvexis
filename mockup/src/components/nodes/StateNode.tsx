import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Cog } from 'lucide-react';
import type { StateNodeData } from '../../types';

const StateNode = memo(({ data, selected }: NodeProps) => {
  const d = data as StateNodeData;

  return (
    <div
      className={`
        relative min-w-[200px] max-w-[240px] rounded-xl border bg-[#1a1b23] shadow-lg
        ${selected ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-[#2e303a]'}
      `}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3.5 !h-3.5 !bg-amber-400 !border-2 !border-[#1a1b23]"
      />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-1.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/20">
          <Cog size={16} className="text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-slate-100">
            {d.name}
          </div>
        </div>
      </div>

      {/* Assignments */}
      <div className="px-3.5 pb-3.5 pt-1.5 space-y-1.5">
        {d.assignments.map((a) => (
          <div
            key={a.id}
            className="rounded-md bg-[#252630] px-2.5 py-1.5 text-xs font-mono text-amber-200/80 leading-relaxed"
          >
            {a.expression}
          </div>
        ))}
      </div>

      {/* Single output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3.5 !h-3.5 !bg-amber-400 !border-2 !border-[#1a1b23]"
      />
    </div>
  );
});

StateNode.displayName = 'StateNode';
export default StateNode;
