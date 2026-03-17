import type { AppNode, AppEdge } from '../types';

export const sampleNodes: AppNode[] = [
  // === SCENE NODES ===
  {
    id: 'scene-intro',
    type: 'scene',
    position: { x: 0, y: 0 },
    data: {
      type: 'scene',
      name: 'Opening Cinematic',
      isRoot: true,
      isEnd: false,
      backgroundColor: '#1a1a2e',
      duration: 45.0,
      videoLayers: [
        { id: 'v1', assetName: 'bg_forest_loop.mov', startAt: 0, duration: 45, hasAlpha: false },
        { id: 'v2', assetName: 'particles_overlay.mov', startAt: 2, duration: 40, hasAlpha: true },
      ],
      audioTracks: [
        { id: 'a1', assetName: 'ambient_forest.wav', startAt: 0, duration: 45 },
        { id: 'a2', assetName: 'narration_intro.wav', startAt: 3, duration: 28 },
      ],
      decisions: [
        { key: 'EXPLORE_CAVE', isDefault: true },
        { key: 'FOLLOW_RIVER', isDefault: false },
        { key: 'CLIMB_MOUNTAIN', isDefault: false },
      ],
      decisionAppearance: { timing: 'at-timestamp', timestamp: 38 },
    },
  },
  {
    id: 'scene-cave',
    type: 'scene',
    position: { x: -350, y: 300 },
    data: {
      type: 'scene',
      name: 'Dark Cave',
      isRoot: false,
      isEnd: false,
      backgroundColor: '#0a0a12',
      duration: 32.0,
      videoLayers: [
        { id: 'v1', assetName: 'cave_interior.mov', startAt: 0, duration: 32, hasAlpha: false },
        { id: 'v2', assetName: 'torch_flicker.mov', startAt: 1, duration: 30, hasAlpha: true },
      ],
      audioTracks: [
        { id: 'a1', assetName: 'cave_drip.wav', startAt: 0, duration: 32 },
      ],
      decisions: [
        { key: 'TAKE_GEM', isDefault: false },
        { key: 'LEAVE_CAVE', isDefault: true },
      ],
      decisionAppearance: { timing: 'after-video' },
    },
  },
  {
    id: 'scene-river',
    type: 'scene',
    position: { x: 0, y: 300 },
    data: {
      type: 'scene',
      name: 'River Crossing',
      isRoot: false,
      isEnd: false,
      backgroundColor: '#0e2a3b',
      duration: 25.0,
      videoLayers: [
        { id: 'v1', assetName: 'river_wide.mov', startAt: 0, duration: 25, hasAlpha: false },
      ],
      audioTracks: [
        { id: 'a1', assetName: 'water_flowing.wav', startAt: 0, duration: 25 },
      ],
      decisions: [],
      decisionAppearance: { timing: 'after-video' },
    },
  },
  {
    id: 'scene-mountain',
    type: 'scene',
    position: { x: 350, y: 300 },
    data: {
      type: 'scene',
      name: 'Mountain Summit',
      isRoot: false,
      isEnd: false,
      backgroundColor: '#1a2a3a',
      duration: 38.0,
      videoLayers: [
        { id: 'v1', assetName: 'mountain_climb.mov', startAt: 0, duration: 38, hasAlpha: false },
        { id: 'v2', assetName: 'clouds_overlay.mov', startAt: 5, duration: 33, hasAlpha: true },
      ],
      audioTracks: [
        { id: 'a1', assetName: 'wind_howling.wav', startAt: 0, duration: 38 },
        { id: 'a2', assetName: 'epic_score.wav', startAt: 10, duration: 28 },
      ],
      decisions: [
        { key: 'CONTINUE', isDefault: true },
      ],
      decisionAppearance: { timing: 'after-video' },
    },
  },
  {
    id: 'scene-ending-good',
    type: 'scene',
    position: { x: -200, y: 900 },
    data: {
      type: 'scene',
      name: 'Good Ending',
      isRoot: false,
      isEnd: true,
      backgroundColor: '#1a3a1a',
      duration: 60.0,
      videoLayers: [
        { id: 'v1', assetName: 'ending_good.mov', startAt: 0, duration: 60, hasAlpha: false },
      ],
      audioTracks: [
        { id: 'a1', assetName: 'victory_theme.wav', startAt: 0, duration: 60 },
      ],
      decisions: [],
      decisionAppearance: { timing: 'after-video' },
    },
  },
  {
    id: 'scene-ending-bad',
    type: 'scene',
    position: { x: 200, y: 900 },
    data: {
      type: 'scene',
      name: 'Bad Ending',
      isRoot: false,
      isEnd: true,
      backgroundColor: '#3a1a1a',
      duration: 40.0,
      videoLayers: [
        { id: 'v1', assetName: 'ending_bad.mov', startAt: 0, duration: 40, hasAlpha: false },
      ],
      audioTracks: [
        { id: 'a1', assetName: 'defeat_theme.wav', startAt: 0, duration: 40 },
      ],
      decisions: [],
      decisionAppearance: { timing: 'after-video' },
    },
  },

  // === STATE NODES ===
  {
    id: 'state-visit-count',
    type: 'state',
    position: { x: -350, y: 520 },
    data: {
      type: 'state',
      name: 'Increment Visits',
      assignments: [
        { id: 's1', expression: '#CAVE_VISITS = #CAVE_VISITS + 1' },
      ],
    },
  },
  {
    id: 'state-take-gem',
    type: 'state',
    position: { x: -500, y: 520 },
    data: {
      type: 'state',
      name: 'Take the Gem',
      assignments: [
        { id: 's1', expression: '#HAS_GEM = true' },
        { id: 's2', expression: '#SCORE = #SCORE + 50' },
      ],
    },
  },
  {
    id: 'state-river-cross',
    type: 'state',
    position: { x: 0, y: 520 },
    data: {
      type: 'state',
      name: 'River Crossed',
      assignments: [
        { id: 's1', expression: "#RIVER_CROSSED = true" },
        { id: 's2', expression: '#SCORE = #SCORE + 25' },
      ],
    },
  },

  // === DECISION NODES ===
  {
    id: 'decision-gem-check',
    type: 'decision',
    position: { x: -100, y: 680 },
    data: {
      type: 'decision',
      name: 'Check Gem & Score',
      conditions: [
        { id: 'c1', expression: '#HAS_GEM == true and #SCORE >= 75', isElse: false },
        { id: 'c2', expression: '#SCORE >= 50', isElse: false },
        { id: 'c3', expression: '', isElse: true },
      ],
    },
  },

  // === UNREACHABLE NODE (for warning demo) ===
  {
    id: 'scene-orphan',
    type: 'scene',
    position: { x: 600, y: 100 },
    data: {
      type: 'scene',
      name: 'Unused Scene (WIP)',
      isRoot: false,
      isEnd: false,
      backgroundColor: '#2a2a2a',
      duration: 15.0,
      videoLayers: [
        { id: 'v1', assetName: 'placeholder.mov', startAt: 0, duration: 15, hasAlpha: false },
      ],
      audioTracks: [],
      decisions: [],
      decisionAppearance: { timing: 'after-video' },
    },
  },
];

export const sampleEdges: AppEdge[] = [
  // From Opening: 3 decisions
  {
    id: 'e-intro-cave',
    source: 'scene-intro',
    target: 'scene-cave',
    sourceHandle: 'decision-EXPLORE_CAVE',
    data: { label: 'Explore Cave', transition: { type: 'crossfade', duration: 1.5 } },
  },
  {
    id: 'e-intro-river',
    source: 'scene-intro',
    target: 'scene-river',
    sourceHandle: 'decision-FOLLOW_RIVER',
    data: { label: 'Follow River', transition: { type: 'dissolve', duration: 2.0 } },
  },
  {
    id: 'e-intro-mountain',
    source: 'scene-intro',
    target: 'scene-mountain',
    sourceHandle: 'decision-CLIMB_MOUNTAIN',
    data: { label: 'Climb Mountain', transition: { type: 'slide-left', duration: 1.0 } },
  },

  // Cave decisions
  {
    id: 'e-cave-take-gem',
    source: 'scene-cave',
    target: 'state-take-gem',
    sourceHandle: 'decision-TAKE_GEM',
    data: { label: 'Take Gem' },
  },
  {
    id: 'e-cave-leave',
    source: 'scene-cave',
    target: 'state-visit-count',
    sourceHandle: 'decision-LEAVE_CAVE',
    data: { label: 'Leave Cave' },
  },

  // State → cycle back or forward
  {
    id: 'e-take-gem-visit',
    source: 'state-take-gem',
    target: 'state-visit-count',
    data: {},
  },
  {
    id: 'e-visit-count-back',
    source: 'state-visit-count',
    target: 'scene-intro',
    data: { transition: { type: 'fade-in', duration: 1.0 } },
    animated: true,
    style: { strokeDasharray: '5,5' },
  },

  // River → state → decision
  {
    id: 'e-river-state',
    source: 'scene-river',
    target: 'state-river-cross',
    data: {},
  },
  {
    id: 'e-river-cross-decision',
    source: 'state-river-cross',
    target: 'decision-gem-check',
    data: {},
  },

  // Mountain → decision
  {
    id: 'e-mountain-decision',
    source: 'scene-mountain',
    target: 'decision-gem-check',
    sourceHandle: 'decision-CONTINUE',
    data: { label: 'Continue' },
  },

  // Decision outcomes
  {
    id: 'e-decision-good',
    source: 'decision-gem-check',
    target: 'scene-ending-good',
    sourceHandle: 'condition-c1',
    data: { label: 'Gem + High Score', transition: { type: 'crossfade', duration: 2.0 } },
  },
  {
    id: 'e-decision-medium',
    source: 'decision-gem-check',
    target: 'scene-ending-good',
    sourceHandle: 'condition-c2',
    data: { label: 'Score >= 50', transition: { type: 'fade-in', duration: 1.5 } },
  },
  {
    id: 'e-decision-bad',
    source: 'decision-gem-check',
    target: 'scene-ending-bad',
    sourceHandle: 'condition-c3',
    data: { label: 'Else', transition: { type: 'wipe', duration: 1.5 } },
  },
];
