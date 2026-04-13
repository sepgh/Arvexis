import { useCallback, useEffect, useRef } from 'react'
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
import { recordHistoryEntry } from '@/history'
import {
  captureEdgeSnapshot,
  captureGraphDeletionSnapshot,
  restoreEdgeSnapshot,
  restoreGraphDeletionSnapshot,
} from '@/history/graph'
import { useEditorStore } from '@/store'

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

const NODE_HISTORY_LABEL: Record<NodeType, string> = {
  scene: 'Scene',
  state: 'State',
  condition: 'Condition',
}

interface PendingCascadeEdgeDeletion {
  edgeIds: Set<string>
  timeoutId: number
}

export function useGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])
  const renameNodeRef = useRef<(id: string, name: string) => Promise<void>>(async () => {})
  const setRootNodeRef = useRef<(id: string) => Promise<void>>(async () => {})
  const pendingCascadeEdgeDeletionRef = useRef<PendingCascadeEdgeDeletion | null>(null)

  const selectNode = useCallback((id: string | null) => {
    useEditorStore.getState().setSelectedNodeId(id)
  }, [])

  const selectEdge = useCallback((id: string | null) => {
    useEditorStore.getState().setSelectedEdgeId(id)
  }, [])

  const clearSelection = useCallback(() => {
    useEditorStore.getState().setSelectedNodeId(null)
  }, [])

  const scheduleCascadeEdgeDeletionCleanup = useCallback((edgeIds: string[]) => {
    const current = pendingCascadeEdgeDeletionRef.current
    if (current) {
      window.clearTimeout(current.timeoutId)
    }
    if (edgeIds.length === 0) {
      pendingCascadeEdgeDeletionRef.current = null
      return
    }

    const pending: PendingCascadeEdgeDeletion = {
      edgeIds: new Set(edgeIds),
      timeoutId: window.setTimeout(() => {
        if (pendingCascadeEdgeDeletionRef.current === pending) {
          pendingCascadeEdgeDeletionRef.current = null
        }
      }, 250),
    }
    pendingCascadeEdgeDeletionRef.current = pending
  }, [])

  const consumeCascadeDeletedEdges = useCallback((deleted: FlowEdge[]) => {
    const remainingNodeIds = new Set(nodes.map((node) => node.id))
    const nodeAttached = deleted.filter(
      (edge) => remainingNodeIds.has(edge.source) && remainingNodeIds.has(edge.target),
    )

    const pending = pendingCascadeEdgeDeletionRef.current
    if (!pending) {
      return nodeAttached
    }

    const filtered = nodeAttached.filter((edge) => !pending.edgeIds.has(edge.id))
    let removedAny = false
    for (const edge of deleted) {
      if (pending.edgeIds.delete(edge.id)) {
        removedAny = true
      }
    }

    if (pending.edgeIds.size === 0) {
      window.clearTimeout(pending.timeoutId)
      pendingCascadeEdgeDeletionRef.current = null
    } else if (removedAny) {
      pendingCascadeEdgeDeletionRef.current = pending
    }

    return filtered
  }, [nodes])

  const attachCallbacks = useCallback((gn: GraphNode): FlowNodeData => {
    return {
      ...gn,
      onRename: (id: string, name: string) => renameNodeRef.current(id, name),
      onSetRoot: (id: string) => setRootNodeRef.current(id),
    }
  }, [])

  const toFlowNode = useCallback((gn: GraphNode): FlowNode => {
    return {
      id: gn.id,
      type: gn.type,
      position: { x: gn.posX, y: gn.posY },
      data: attachCallbacks(gn),
    }
  }, [attachCallbacks])

  const toFlowEdge = useCallback((ge: GraphEdge): FlowEdge => {
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
  }, [])

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
  }, [setEdges, setNodes, toFlowEdge, toFlowNode])

  useEffect(() => {
    void loadGraph()
  }, [loadGraph])

  const renameNode = useCallback(async (id: string, name: string) => {
    const existing = nodes.find((node) => node.id === id)
    const nextName = name.trim()
    if (!existing || !nextName || existing.data.name === nextName) {
      return
    }

    try {
      const updatedNode = await graphApi.updateNode(id, { name: nextName })
      setNodes((nds) => nds.map((node) => node.id === id ? toFlowNode(updatedNode) : node))
      recordHistoryEntry({
        label: 'Rename Node',
        undo: async () => {
          await graphApi.updateNode(id, { name: existing.data.name })
          await loadGraph()
          selectNode(id)
        },
        redo: async () => {
          await graphApi.updateNode(id, { name: nextName })
          await loadGraph()
          selectNode(id)
        },
      })
    } catch (e) {
      console.error('Failed to rename node:', e)
    }
  }, [loadGraph, nodes, selectNode, setNodes, toFlowNode])

  const setRootNode = useCallback(async (id: string) => {
    const previousRootId = nodes.find((node) => node.data.isRoot)?.id ?? null
    if (previousRootId === id) {
      return
    }

    try {
      await graphApi.setRoot(id)
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: { ...node.data, isRoot: node.id === id },
        })),
      )
      recordHistoryEntry({
        label: 'Set Root',
        undo: async () => {
          if (previousRootId) {
            await graphApi.setRoot(previousRootId)
          } else {
            await graphApi.clearRoot()
          }
          await loadGraph()
          selectNode(id)
        },
        redo: async () => {
          await graphApi.setRoot(id)
          await loadGraph()
          selectNode(id)
        },
      })
    } catch (e) {
      console.error('Failed to set root node:', e)
      await loadGraph()
    }
  }, [loadGraph, nodes, selectNode, setNodes])

  useEffect(() => {
    renameNodeRef.current = renameNode
  }, [renameNode])

  useEffect(() => {
    setRootNodeRef.current = setRootNode
  }, [setRootNode])

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
      recordHistoryEntry({
        label: 'Create Edge',
        undo: async () => {
          await graphApi.deleteEdge(ge.id)
          await loadGraph()
          clearSelection()
        },
        redo: async () => {
          await graphApi.createEdge({
            id: ge.id,
            sourceNodeId: ge.sourceNodeId,
            targetNodeId: ge.targetNodeId,
            sourceDecisionKey: ge.sourceDecisionKey,
            sourceConditionOrder: ge.sourceConditionOrder,
            sourceConditionName: ge.sourceConditionName,
          })
          await loadGraph()
          selectEdge(ge.id)
        },
      })
    } catch (e) {
      console.error('Failed to create edge:', e)
    }
  }, [clearSelection, edges, loadGraph, nodes, selectEdge, setEdges, toFlowEdge])

  const onNodeDragStop = useCallback<OnNodeDrag<FlowNode>>(
    async (_event, node) => {
      const previousX = node.data.posX
      const previousY = node.data.posY
      const nextX = node.position.x
      const nextY = node.position.y
      if (previousX === nextX && previousY === nextY) {
        return
      }

      try {
        const updatedNode = await graphApi.updateNode(node.id, { posX: nextX, posY: nextY })
        setNodes((nds) => nds.map((current) => current.id === node.id ? toFlowNode(updatedNode) : current))
        recordHistoryEntry({
          label: 'Move Node',
          undo: async () => {
            await graphApi.updateNode(node.id, { posX: previousX, posY: previousY })
            await loadGraph()
            selectNode(node.id)
          },
          redo: async () => {
            await graphApi.updateNode(node.id, { posX: nextX, posY: nextY })
            await loadGraph()
            selectNode(node.id)
          },
        })
      } catch (e) {
        console.error('Failed to sync node position:', e)
        await loadGraph()
      }
    },
    [loadGraph, selectNode, setNodes, toFlowNode]
  )

  const onNodesDelete = useCallback<OnNodesDelete<FlowNode>>(async (deleted) => {
    if (deleted.length === 0) {
      return
    }

    const deletedNodeIds = deleted.map((node) => node.id)
    const graphEdges = edges.map((edge) => edge.data as GraphEdge)
    const connectedEdgeIds = graphEdges
      .filter((edge) => deletedNodeIds.includes(edge.sourceNodeId) || deletedNodeIds.includes(edge.targetNodeId))
      .map((edge) => edge.id)

    scheduleCascadeEdgeDeletionCleanup(connectedEdgeIds)

    try {
      const graphNodes = await Promise.all(deletedNodeIds.map((id) => graphApi.getNode(id)))
      const snapshot = await captureGraphDeletionSnapshot(graphNodes, graphEdges)
      for (const nodeId of deletedNodeIds) {
        await graphApi.deleteNode(nodeId)
      }
      clearSelection()
      recordHistoryEntry({
        label: graphNodes.length === 1
          ? `Delete ${NODE_HISTORY_LABEL[graphNodes[0].type]}`
          : `Delete ${graphNodes.length} Nodes`,
        undo: async () => {
          await restoreGraphDeletionSnapshot(snapshot)
          await loadGraph()
          if (snapshot.nodes.length === 1) {
            selectNode(snapshot.nodes[0].node.id)
          } else {
            clearSelection()
          }
        },
        redo: async () => {
          clearSelection()
          for (const nodeId of deletedNodeIds) {
            await graphApi.deleteNode(nodeId)
          }
          await loadGraph()
        },
      })
    } catch (e) {
      console.error('Failed to delete node:', e)
      await loadGraph()
    }
  }, [clearSelection, edges, loadGraph, scheduleCascadeEdgeDeletionCleanup, selectNode])

  const onEdgesDelete = useCallback<OnEdgesDelete<FlowEdge>>(async (deleted) => {
    const filtered = consumeCascadeDeletedEdges(deleted)
    if (filtered.length === 0) {
      return
    }

    try {
      const snapshots = await Promise.all(filtered.map((edge) => captureEdgeSnapshot(edge.data as GraphEdge)))
      for (const edge of filtered) {
        await graphApi.deleteEdge(edge.id)
      }
      clearSelection()
      recordHistoryEntry({
        label: snapshots.length === 1 ? 'Delete Edge' : `Delete ${snapshots.length} Edges`,
        undo: async () => {
          for (const snapshot of snapshots) {
            await restoreEdgeSnapshot(snapshot)
          }
          await loadGraph()
          if (snapshots.length === 1) {
            selectEdge(snapshots[0].edge.id)
          } else {
            clearSelection()
          }
        },
        redo: async () => {
          clearSelection()
          for (const snapshot of snapshots) {
            await graphApi.deleteEdge(snapshot.edge.id)
          }
          await loadGraph()
        },
      })
    } catch (err) {
      console.error('Failed to delete edge:', err)
      await loadGraph()
    }
  }, [clearSelection, consumeCascadeDeletedEdges, loadGraph, selectEdge])

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
        recordHistoryEntry({
          label: `Add ${NODE_HISTORY_LABEL[type]}`,
          undo: async () => {
            await graphApi.deleteNode(gn.id)
            await loadGraph()
            clearSelection()
          },
          redo: async () => {
            await graphApi.createNode({
              id: gn.id,
              name: gn.name,
              type: gn.type,
              posX: gn.posX,
              posY: gn.posY,
            })
            await loadGraph()
            selectNode(gn.id)
          },
        })
      } catch (e) {
        console.error('Failed to add node:', e)
      }
    },
    [clearSelection, loadGraph, selectNode, setNodes, toFlowNode]
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
