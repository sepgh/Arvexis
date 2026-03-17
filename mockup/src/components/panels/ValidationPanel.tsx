import { AlertTriangle, XCircle, CheckCircle } from 'lucide-react';

interface ValidationItem {
  id: string;
  type: 'error' | 'warning';
  message: string;
  nodeId?: string;
}

const mockValidation: ValidationItem[] = [
  { id: 'w1', type: 'warning', message: 'Unreachable node: "Unused Scene (WIP)"', nodeId: 'scene-orphan' },
  { id: 'w2', type: 'warning', message: 'No outgoing edges from "Good Ending" (has END flag — OK)', nodeId: 'scene-ending-good' },
  { id: 'w3', type: 'warning', message: 'No outgoing edges from "Bad Ending" (has END flag — OK)', nodeId: 'scene-ending-bad' },
];

interface ValidationPanelProps {
  onFocusNode?: (nodeId: string) => void;
}

export default function ValidationPanel({ onFocusNode }: ValidationPanelProps) {
  const errors = mockValidation.filter((v) => v.type === 'error');
  const warnings = mockValidation.filter((v) => v.type === 'warning');

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        {errors.length === 0 ? (
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle size={16} />
            No errors
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-red-400">
            <XCircle size={16} />
            {errors.length} error{errors.length !== 1 ? 's' : ''}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle size={16} />
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="space-y-2">
        {mockValidation.map((item) => (
          <button
            key={item.id}
            onClick={() => item.nodeId && onFocusNode?.(item.nodeId)}
            className={`w-full flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-xs leading-relaxed transition hover:brightness-110 ${
              item.type === 'error'
                ? 'border-red-500/30 bg-red-500/5 text-red-300'
                : 'border-amber-500/30 bg-amber-500/5 text-amber-300'
            }`}
          >
            {item.type === 'error' ? (
              <XCircle size={14} className="mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            )}
            <span>{item.message}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
