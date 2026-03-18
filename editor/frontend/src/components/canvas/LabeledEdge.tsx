import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'
import type { FlowEdgeData } from '@/hooks/useGraph'

export default function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<Edge<FlowEdgeData>>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const transitionType = data?.transition?.type
  const decisionKey    = data?.sourceDecisionKey
  const condName       = data?.sourceConditionName

  const hasLabel = !!(transitionType && transitionType !== 'none') || !!decisionKey || !!condName

  const labelParts: string[] = []
  if (decisionKey)  labelParts.push(decisionKey)
  if (condName)     labelParts.push(condName)
  if (transitionType && transitionType !== 'none') labelParts.push(transitionType.replace('_', ' '))

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#818cf8' : '#475569',
          strokeWidth: selected ? 2.5 : 2,
        }}
      />
      {hasLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position:  'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="text-[9px] px-1.5 py-0.5 rounded bg-card border border-border/60 text-muted-foreground font-medium shadow-sm"
          >
            {labelParts.join(' · ')}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
