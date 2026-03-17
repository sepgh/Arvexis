import { useState, useCallback } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState, type OnSelectionChangeParams } from '@xyflow/react';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import DetailPanel from './components/layout/DetailPanel';
import EditorCanvas from './components/canvas/EditorCanvas';
import { sampleNodes, sampleEdges } from './data/sampleGraph';
import type { AppNode, AppEdge } from './types';

export default function App() {
  const [nodes, , onNodesChange] = useNodesState(sampleNodes);
  const [edges, , onEdgesChange] = useEdgesState(sampleEdges);
  const rootNode = sampleNodes.find((n) => n.data.type === 'scene' && (n.data as any).isRoot) ?? null;
  const [selectedNode, setSelectedNode] = useState<AppNode | null>(rootNode);
  const [selectedEdge, setSelectedEdge] = useState<AppEdge | null>(null);

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      const selNodes = params.nodes as AppNode[];
      const selEdges = params.edges as AppEdge[];

      if (selNodes.length === 1) {
        setSelectedNode(selNodes[0]);
        setSelectedEdge(null);
      } else if (selEdges.length === 1) {
        setSelectedNode(null);
        setSelectedEdge(selEdges[0]);
      } else {
        setSelectedNode(null);
        setSelectedEdge(null);
      }
    },
    []
  );

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const handleFocusNode = useCallback((_nodeId: string) => {
    // In real implementation: center canvas on node and select it
  }, []);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 min-h-0">
          <Sidebar onFocusNode={handleFocusNode} />
          <div className="flex-1 min-w-0">
            <EditorCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onSelectionChange={handleSelectionChange}
            />
          </div>
          <DetailPanel
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onClose={handleClosePanel}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
