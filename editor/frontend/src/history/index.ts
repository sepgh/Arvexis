import { create } from 'zustand'
import { useEditorStore } from '@/store'

export interface HistoryEntry {
  label: string
  undo: () => Promise<void>
  redo: () => Promise<void>
}

interface StoredHistoryEntry extends HistoryEntry {
  id: number
}

interface HistoryState {
  undoStack: StoredHistoryEntry[]
  redoStack: StoredHistoryEntry[]
  isReplaying: boolean
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
}

let nextHistoryEntryId = 1

function deriveState(undoStack: StoredHistoryEntry[], redoStack: StoredHistoryEntry[]) {
  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel: undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null,
    redoLabel: redoStack.length > 0 ? redoStack[redoStack.length - 1].label : null,
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'History action failed'
}

export const useHistoryStore = create<HistoryState>(() => ({
  undoStack: [],
  redoStack: [],
  isReplaying: false,
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
}))

export function clearHistory() {
  useHistoryStore.setState({
    undoStack: [],
    redoStack: [],
    isReplaying: false,
    ...deriveState([], []),
  })
}

export function recordHistoryEntry(entry: HistoryEntry) {
  const state = useHistoryStore.getState()
  if (state.isReplaying) {
    return
  }

  const nextEntry: StoredHistoryEntry = {
    id: nextHistoryEntryId++,
    ...entry,
  }
  const undoStack = [...state.undoStack, nextEntry]

  useHistoryStore.setState({
    undoStack,
    redoStack: [],
    ...deriveState(undoStack, []),
  })
}

async function runHistoryAction(kind: 'undo' | 'redo') {
  const state = useHistoryStore.getState()
  const sourceStack = kind === 'undo' ? state.undoStack : state.redoStack
  const entry = sourceStack[sourceStack.length - 1]

  if (!entry || state.isReplaying) {
    return false
  }

  useHistoryStore.setState({ isReplaying: true })

  try {
    if (kind === 'undo') {
      await entry.undo()
    } else {
      await entry.redo()
    }

    const current = useHistoryStore.getState()
    const currentSource = kind === 'undo' ? current.undoStack : current.redoStack
    const currentTarget = kind === 'undo' ? current.redoStack : current.undoStack
    const nextSource = currentSource.slice(0, -1)
    const nextTarget = [...currentTarget, entry]
    const undoStack = kind === 'undo' ? nextSource : nextTarget
    const redoStack = kind === 'undo' ? nextTarget : nextSource

    useHistoryStore.setState({
      undoStack,
      redoStack,
      isReplaying: false,
      ...deriveState(undoStack, redoStack),
    })
    return true
  } catch (error) {
    console.error(`Failed to ${kind}:`, error)
    useEditorStore.getState().setSaveStatus('error', getErrorMessage(error))
    useHistoryStore.setState({ isReplaying: false })
    return false
  }
}

export function undoHistory() {
  return runHistoryAction('undo')
}

export function redoHistory() {
  return runHistoryAction('redo')
}
