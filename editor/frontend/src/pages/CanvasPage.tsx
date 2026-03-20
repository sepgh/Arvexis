import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useHealth } from '@/hooks/useHealth'
import { useEditorStore } from '@/store'
import { useGraph, type FlowNode, type FlowEdge } from '@/hooks/useGraph'
import AssetBrowser from '@/components/assets/AssetBrowser'
import GraphToolbar from '@/components/canvas/GraphToolbar'
import SceneNode from '@/components/canvas/nodes/SceneNode'
import StateNode from '@/components/canvas/nodes/StateNode'
import ConditionNode from '@/components/canvas/nodes/DecisionNode'
import NodeEditorPanel from '@/components/editor/NodeEditorPanel'
import EdgeEditorPanel from '@/components/editor/EdgeEditorPanel'
import ValidationPanel from '@/components/editor/ValidationPanel'
import ProjectSettingsPanel from '@/components/editor/ProjectSettingsPanel'
import LabeledEdge from '@/components/canvas/LabeledEdge'
import ResizableSidePanel from '@/components/layout/ResizableSidePanel'
import LocalizationPanel from '@/components/editor/LocalizationPanel'
import CustomCssPanel from '@/components/editor/CustomCssPanel'
import type { NodeType } from '@/types'

const NODE_TYPES: NodeTypes = {
  scene:     SceneNode as NodeTypes[string],
  state:     StateNode as NodeTypes[string],
  condition: ConditionNode as NodeTypes[string],
}

const EDGE_TYPES: EdgeTypes = {
  labeled: LabeledEdge as EdgeTypes[string],
}

function GraphCanvas() {
  const backendStatus = useHealth()
  const { screenToFlowPosition } = useReactFlow()
  const selectedNodeId       = useEditorStore(s => s.selectedNodeId)
  const setSelectedNodeId    = useEditorStore(s => s.setSelectedNodeId)
  const selectedEdgeId          = useEditorStore(s => s.selectedEdgeId)
  const setSelectedEdgeId       = useEditorStore(s => s.setSelectedEdgeId)
  const validationPanelOpen     = useEditorStore(s => s.validationPanelOpen)
  const localizationPanelOpen   = useEditorStore(s => s.localizationPanelOpen)
  const projectSettingsPanelOpen = useEditorStore(s => s.projectSettingsPanelOpen)
  const customCssPanelOpen        = useEditorStore(s => s.customCssPanelOpen)

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeDragStop,
    onNodesDelete,
    onEdgesDelete,
    addNode,
    reloadGraph,
  } = useGraph()

  const handleAddNode = useCallback(
    (type: NodeType) => {
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      addNode(type, { x: center.x + (Math.random() - 0.5) * 80, y: center.y + (Math.random() - 0.5) * 80 })
    },
    [screenToFlowPosition, addNode]
  )

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => setSelectedNodeId(node.id),
    [setSelectedNodeId]
  )

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: FlowEdge) => setSelectedEdgeId(edge.id),
    [setSelectedEdgeId]
  )

  const selectedNodeData = nodes.find(n => n.id === selectedNodeId)?.data ?? null

  const defaultEdgeOptions = useMemo(() => ({ style: { stroke: '#475569', strokeWidth: 2 } }), [])

  return (
    <div className="flex flex-1 min-w-0 h-full overflow-hidden">
      <div className="relative flex-1 min-w-0">
      <GraphToolbar onAddNode={handleAddNode} />

      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null) }}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode="dark"
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        selectionOnDrag
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(n) => {
            if (n.type === 'scene') return '#3b82f6'
            if (n.type === 'state') return '#f59e0b'
            return '#8b5cf6'
          }}
          className="!bg-card !border-border"
        />
      </ReactFlow>

      {/* Backend connectivity badge */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-card border border-border pointer-events-none">
        <span
          className={[
            'w-2 h-2 rounded-full',
            backendStatus === 'ok'
              ? 'bg-green-500'
              : backendStatus === 'error'
              ? 'bg-red-500'
              : 'bg-yellow-500 animate-pulse',
          ].join(' ')}
        />
        {backendStatus === 'ok'
          ? 'Backend connected'
          : backendStatus === 'error'
          ? 'Backend unreachable'
          : 'Connecting…'}
      </div>
      </div>
      {selectedNodeData && (
        <ResizableSidePanel side="right" initialWidth={420} minWidth={320} maxWidth={700}>
          <NodeEditorPanel
            nodeData={selectedNodeData}
            onConditionsChanged={reloadGraph}
            onNodeUpdated={reloadGraph}
          />
        </ResizableSidePanel>
      )}
      {selectedEdgeId && !selectedNodeData && (
        <ResizableSidePanel side="right" initialWidth={420} minWidth={320} maxWidth={700}>
          <EdgeEditorPanel edgeId={selectedEdgeId} />
        </ResizableSidePanel>
      )}
      {validationPanelOpen && !selectedNodeData && !selectedEdgeId && <ValidationPanel />}
      {localizationPanelOpen && !selectedNodeData && !selectedEdgeId && (
        <LocalizationPanel />
      )}
      {projectSettingsPanelOpen && (
        <ResizableSidePanel side="right" initialWidth={460} minWidth={360} maxWidth={720}>
          <ProjectSettingsPanel />
        </ResizableSidePanel>
      )}
      {customCssPanelOpen && (
        <ResizableSidePanel side="right" initialWidth={480} minWidth={360} maxWidth={720}>
          <CustomCssPanel />
        </ResizableSidePanel>
      )}
    </div>
  )
}

export default function CanvasPage() {
  const assetPanelOpen = useEditorStore((s) => s.assetPanelOpen)

  return (
    <div className="flex w-full h-full overflow-hidden">
      {assetPanelOpen && (
        <ResizableSidePanel side="left" initialWidth={380} minWidth={280} maxWidth={600}>
          <AssetBrowser />
        </ResizableSidePanel>
      )}
      <ReactFlowProvider>
        <GraphCanvas />
      </ReactFlowProvider>
    </div>
  )
}
