import type { Node, Edge } from '@xyflow/react';

export interface VideoLayer {
  id: string;
  assetName: string;
  startAt: number;
  duration: number;
  hasAlpha: boolean;
}

export interface AudioTrack {
  id: string;
  assetName: string;
  startAt: number;
  duration: number;
}

export interface SceneDecision {
  key: string;
  isDefault: boolean;
}

export interface DecisionAppearance {
  timing: 'after-video' | 'at-timestamp';
  timestamp?: number;
}

export interface SceneNodeData {
  type: 'scene';
  name: string;
  videoLayers: VideoLayer[];
  audioTracks: AudioTrack[];
  backgroundColor: string;
  isEnd: boolean;
  isRoot: boolean;
  decisions: SceneDecision[];
  decisionAppearance: DecisionAppearance;
  duration: number;
  [key: string]: unknown;
}

export interface StateAssignment {
  id: string;
  expression: string;
}

export interface StateNodeData {
  type: 'state';
  name: string;
  assignments: StateAssignment[];
  [key: string]: unknown;
}

export interface DecisionCondition {
  id: string;
  expression: string;
  isElse: boolean;
}

export interface DecisionNodeData {
  type: 'decision';
  name: string;
  conditions: DecisionCondition[];
  [key: string]: unknown;
}

export type AppNodeData = SceneNodeData | StateNodeData | DecisionNodeData;
export type AppNode = Node<AppNodeData>;
export type AppEdge = Edge & {
  data?: {
    transition?: {
      type: 'none' | 'fade-in' | 'fade-out' | 'crossfade' | 'slide-left' | 'slide-right' | 'wipe' | 'dissolve' | 'cut' | 'video';
      duration?: number;
    };
    label?: string;
  };
};
