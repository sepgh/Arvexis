import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type NodeTypes,
  type OnSelectionChangeParams,
  type OnNodesChange,
  type OnEdgesChange,
  type DefaultEdgeOptions,
  type ColorMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import SceneNode from '../nodes/SceneNode';
import StateNode from '../nodes/StateNode';
import DecisionNode from '../nodes/DecisionNode';
import type { AppNode, AppEdge } from '../../types';

interface EditorCanvasProps {
  nodes: AppNode[];
  edges: AppEdge[];
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<AppEdge>;
  onSelectionChange: (params: OnSelectionChangeParams) => void;
}

export default function EditorCanvas({ nodes, edges, onNodesChange, onEdgesChange, onSelectionChange }: EditorCanvasProps) {
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      scene: SceneNode,
      state: StateNode,
      decision: DecisionNode,
    }),
    []
  );

  const defaultEdgeOptions: DefaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
      style: { stroke: '#4b5563', strokeWidth: 2 },
    }),
    []
  );

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      onSelectionChange(params);
    },
    [onSelectionChange]
  );

  const minimapNodeColor = useCallback((node: AppNode) => {
    switch (node.type) {
      case 'scene': return '#3b82f6';
      case 'state': return '#f59e0b';
      case 'decision': return '#8b5cf6';
      default: return '#6b7280';
    }
  }, []);

  const edgesWithLabels = useMemo(() => {
    return edges.map((edge) => {
      const label = edge.data?.label;
      const transition = edge.data?.transition;
      let edgeLabel = '';
      if (label) edgeLabel = label;
      if (transition && transition.type !== 'none') {
        edgeLabel += edgeLabel ? ` [${transition.type}]` : transition.type;
      }
      return {
        ...edge,
        label: edgeLabel || undefined,
        labelStyle: { fill: '#94a3b8', fontSize: 12, fontFamily: 'Inter', fontWeight: 500 },
        labelBgStyle: { fill: '#1a1b23', fillOpacity: 0.9 },
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 4,
        style: {
          ...edge.style,
          stroke: edge.animated ? '#34d399' : '#4b5563',
          strokeWidth: 2,
        },
      };
    });
  }, [edges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edgesWithLabels}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onSelectionChange={handleSelectionChange}
      nodesDraggable
      fitView
      fitViewOptions={{ padding: 0.2 }}
      colorMode={'dark' as ColorMode}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      maxZoom={2}
      snapToGrid
      snapGrid={[10, 10]}
    >
      <Controls position="bottom-left" />
      <MiniMap
        nodeColor={minimapNodeColor}
        maskColor="rgba(0, 0, 0, 0.7)"
        position="bottom-right"
      />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e1f2a" />
    </ReactFlow>
  );
}
