import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import type { DecisionNodeData } from '../../types';

const DecisionNode = memo(({ data, selected }: NodeProps) => {
  const d = data as DecisionNodeData;

  return (
    <div
      className={`
        relative min-w-[210px] max-w-[260px] rounded-xl border bg-[#1a1b23] shadow-lg
        ${selected ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-[#2e303a]'}
      `}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3.5 !h-3.5 !bg-violet-400 !border-2 !border-[#1a1b23]"
      />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-1.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/20">
          <GitBranch size={16} className="text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-slate-100">
            {d.name}
          </div>
        </div>
      </div>

      {/* Conditions */}
      <div className="border-t border-[#2e303a] mt-1.5">
        {d.conditions.map((cond, i) => (
          <div
            key={cond.id}
            className={`relative flex items-center gap-2.5 px-3.5 py-2 ${
              i < d.conditions.length - 1 ? 'border-b border-[#2e303a]/50' : ''
            }`}
          >
            {cond.isElse ? (
              <span className="text-xs font-medium text-violet-300 italic">
                else
              </span>
            ) : (
              <span className="rounded-md bg-[#252630] px-2.5 py-1 text-xs font-mono text-violet-200/80 leading-relaxed flex-1 min-w-0 truncate">
                {cond.expression}
              </span>
            )}
            <Handle
              type="source"
              position={Position.Bottom}
              id={`condition-${cond.id}`}
              className="!w-3 !h-3 !bg-violet-400 !border-2 !border-[#1a1b23]"
              style={{ left: `${((i + 1) / (d.conditions.length + 1)) * 100}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
export default DecisionNode;
