import { create } from 'zustand'
import type { ProjectConfig } from '@/types'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface EditorState {
  projectConfig: ProjectConfig | null
  isProjectOpen: boolean
  appLoading: boolean
  assetPanelOpen: boolean
  selectedNodeId: string | null
  selectedEdgeId: string | null
  validationPanelOpen: boolean
  localizationPanelOpen: boolean
  projectSettingsPanelOpen: boolean
  saveStatus: SaveStatus
  saveError: string | null
  setProjectConfig: (config: ProjectConfig) => void
  clearProject: () => void
  setAppLoading: (loading: boolean) => void
  toggleAssetPanel: () => void
  setSelectedNodeId: (id: string | null) => void
  setSelectedEdgeId: (id: string | null) => void
  toggleValidationPanel: () => void
  toggleLocalizationPanel: () => void
  toggleProjectSettingsPanel: () => void
  setSaveStatus: (status: SaveStatus, error?: string | null) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  projectConfig: null,
  isProjectOpen: false,
  appLoading: true,
  assetPanelOpen: false,
  selectedNodeId: null,
  selectedEdgeId: null,
  validationPanelOpen: false,
  localizationPanelOpen: false,
  projectSettingsPanelOpen: false,
  saveStatus: 'idle',
  saveError: null,

  setProjectConfig: (config) =>
    set({ projectConfig: config, isProjectOpen: true }),

  clearProject: () =>
    set({ projectConfig: null, isProjectOpen: false, assetPanelOpen: false, selectedNodeId: null, selectedEdgeId: null, validationPanelOpen: false, localizationPanelOpen: false, projectSettingsPanelOpen: false, saveStatus: 'idle', saveError: null }),

  setAppLoading: (loading) =>
    set({ appLoading: loading }),

  toggleAssetPanel: () =>
    set((s) => ({ assetPanelOpen: !s.assetPanelOpen })),

  setSelectedNodeId: (id) =>
    set({ selectedNodeId: id, selectedEdgeId: null }),

  setSelectedEdgeId: (id) =>
    set({ selectedEdgeId: id, selectedNodeId: null }),

  toggleValidationPanel: () =>
    set((s) => ({ validationPanelOpen: !s.validationPanelOpen })),

  toggleLocalizationPanel: () =>
    set((s) => ({ localizationPanelOpen: !s.localizationPanelOpen })),

  toggleProjectSettingsPanel: () =>
    set((s) => ({ projectSettingsPanelOpen: !s.projectSettingsPanelOpen })),

  setSaveStatus: (status, error = null) =>
    set({ saveStatus: status, saveError: error ?? null }),
}))
