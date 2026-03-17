import { X, Film, Cog, GitBranch, ArrowRight } from 'lucide-react';
import type { AppNode, AppEdge, SceneNodeData, StateNodeData, DecisionNodeData } from '../../types';
import ScenePanel from '../panels/ScenePanel';
import StatePanel from '../panels/StatePanel';
import DecisionPanel from '../panels/DecisionPanel';
import TransitionPanel from '../panels/TransitionPanel';

interface DetailPanelProps {
  selectedNode: AppNode | null;
  selectedEdge: AppEdge | null;
  onClose: () => void;
}

export default function DetailPanel({ selectedNode, selectedEdge, onClose }: DetailPanelProps) {
  if (!selectedNode && !selectedEdge) return null;

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'scene': return <Film size={18} className="text-blue-400" />;
      case 'state': return <Cog size={18} className="text-amber-400" />;
      case 'decision': return <GitBranch size={18} className="text-violet-400" />;
      default: return null;
    }
  };

  const getNodeColorClass = (type: string) => {
    switch (type) {
      case 'scene': return 'text-blue-400';
      case 'state': return 'text-amber-400';
      case 'decision': return 'text-violet-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col border-l border-[#2e303a] bg-[#14151c]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2e303a] px-5 py-4">
        {selectedNode && (
          <div className="flex items-center gap-3 min-w-0">
            {getNodeIcon(selectedNode.data.type)}
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-slate-100">
                {selectedNode.data.name}
              </div>
              <div className={`text-xs font-medium uppercase tracking-wider ${getNodeColorClass(selectedNode.data.type)}`}>
                {selectedNode.data.type} node
              </div>
            </div>
          </div>
        )}
        {selectedEdge && (
          <div className="flex items-center gap-3 min-w-0">
            <ArrowRight size={18} className="text-slate-400" />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-slate-100">
                Edge Transition
              </div>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {selectedEdge.data?.transition?.type || 'none'}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-500 hover:bg-[#1a1b23] hover:text-slate-300 transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* Node name edit */}
      {selectedNode && (
        <div className="border-b border-[#2e303a] px-5 py-4">
          <label className="mb-2 block text-xs font-medium text-slate-500">Node Name</label>
          <input
            type="text"
            value={selectedNode.data.name}
            readOnly
            className="w-full rounded-lg border border-[#2e303a] bg-[#1a1b23] px-3.5 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-10">
        {selectedNode?.data.type === 'scene' && (
          <ScenePanel data={selectedNode.data as SceneNodeData} />
        )}
        {selectedNode?.data.type === 'state' && (
          <StatePanel data={selectedNode.data as StateNodeData} />
        )}
        {selectedNode?.data.type === 'decision' && (
          <DecisionPanel data={selectedNode.data as DecisionNodeData} />
        )}
        {selectedEdge && (
          <TransitionPanel edge={selectedEdge} />
        )}
      </div>
    </div>
  );
}
