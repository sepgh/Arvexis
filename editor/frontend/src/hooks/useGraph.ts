import { useCallback, useEffect } from 'react'
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type OnNodeDrag,
  type OnNodesDelete,
  type OnEdgesDelete,
} from '@xyflow/react'
import type { GraphNode, GraphEdge, NodeType } from '@/types'
import * as graphApi from '@/api/graph'

export type FlowNodeData = GraphNode & {
  onRename: (id: string, name: string) => Promise<void>
  onSetRoot: (id: string) => Promise<void>
  [key: string]: unknown
}

export type FlowEdgeData = GraphEdge & { [key: string]: unknown }

export type FlowNode = Node<FlowNodeData>
export type FlowEdge = Edge<FlowEdgeData>

const NODE_DEFAULT_NAMES: Record<NodeType, string> = {
  scene: 'New Scene',
  state: 'New State',
  condition: 'New Condition',
}

export function useGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])

  const renameNode = useCallback(async (id: string, name: string) => {
    const gNode = await graphApi.updateNode(id, { name })
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: attachCallbacks(gNode, renameNode, setRootNode) } : n)
    )
  }, [])

  const setRootNode = useCallback(async (id: string) => {
    await graphApi.setRoot(id)
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isRoot: n.id === id },
      }))
    )
  }, [])

  function attachCallbacks(gn: GraphNode, onRename: typeof renameNode, onSetRoot: typeof setRootNode): FlowNodeData {
    return { ...gn, onRename, onSetRoot }
  }

  function toFlowNode(gn: GraphNode): FlowNode {
    return {
      id: gn.id,
      type: gn.type,
      position: { x: gn.posX, y: gn.posY },
      data: attachCallbacks(gn, renameNode, setRootNode),
    }
  }

  function toFlowEdge(ge: GraphEdge): FlowEdge {
    // The React Flow sourceHandle must match the handle id on the source node
    const sourceHandle = ge.sourceDecisionKey
      ?? ge.sourceConditionName
      ?? undefined
    return {
      id: ge.id,
      source: ge.sourceNodeId,
      target: ge.targetNodeId,
      sourceHandle: sourceHandle ?? null,
      type: 'labeled',
      data: ge as FlowEdgeData,
    }
  }

  const loadGraph = useCallback(async () => {
    try {
      const [gNodes, gEdges] = await Promise.all([
        graphApi.listNodes(),
        graphApi.listEdges(),
      ])
      setNodes(gNodes.map(toFlowNode))
      setEdges(gEdges.map(toFlowEdge))
    } catch (e) {
      console.error('Failed to load graph:', e)
    }
  }, [])

  useEffect(() => { loadGraph() }, [loadGraph])

  const onConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target) return

    // Resolve what kind of exit the handle represents
    const handle = connection.sourceHandle ?? undefined
    const sourceNode = nodes.find(n => n.id === connection.source)
    const sourceType = sourceNode?.data.type

    // Enforce single-edge-per-exit in the frontend before hitting the API
    if (handle) {
      const alreadyUsed = edges.some(
        e => e.source === connection.source && e.sourceHandle === handle
      )
      if (alreadyUsed) {
        console.warn('Exit already has an outgoing edge:', handle)
        return
      }
    } else if (sourceType === 'state') {
      const alreadyUsed = edges.some(e => e.source === connection.source)
      if (alreadyUsed) {
        console.warn('State node already has an outgoing edge')
        return
      }
    }

    // Build the request based on handle type
    let sourceDecisionKey: string | undefined
    let sourceConditionName: string | undefined

    if (sourceType === 'scene' && handle) {
      sourceDecisionKey = handle
    } else if (sourceType === 'condition' && handle) {
      sourceConditionName = handle
    }

    try {
      const ge = await graphApi.createEdge({
        sourceNodeId: connection.source,
        targetNodeId: connection.target,
        sourceDecisionKey,
        sourceConditionName,
      })
      setEdges((eds) => addEdge(toFlowEdge(ge), eds))
    } catch (e) {
      console.error('Failed to create edge:', e)
    }
  }, [nodes, edges])

  const onNodeDragStop = useCallback<OnNodeDrag<FlowNode>>(
    async (_event, node) => {
      try {
        await graphApi.updateNode(node.id, { posX: node.position.x, posY: node.position.y })
      } catch (e) {
        console.error('Failed to sync node position:', e)
      }
    },
    []
  )

  const onNodesDelete = useCallback<OnNodesDelete<FlowNode>>(async (deleted) => {
    for (const n of deleted) {
      try { await graphApi.deleteNode(n.id) } catch (e) {
        console.error('Failed to delete node:', e)
      }
    }
  }, [])

  const onEdgesDelete = useCallback<OnEdgesDelete<FlowEdge>>(async (deleted) => {
    for (const e of deleted) {
      try { await graphApi.deleteEdge(e.id) } catch (err) {
        console.error('Failed to delete edge:', err)
      }
    }
  }, [])

  const addNode = useCallback(
    async (type: NodeType, position: { x: number; y: number }) => {
      try {
        const gn = await graphApi.createNode({
          name: NODE_DEFAULT_NAMES[type],
          type,
          posX: position.x,
          posY: position.y,
        })
        setNodes((nds) => [...nds, toFlowNode(gn)])
      } catch (e) {
        console.error('Failed to add node:', e)
      }
    },
    []
  )

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeDragStop,
    onNodesDelete,
    onEdgesDelete,
    addNode,
    reloadGraph: loadGraph,
  }
}
