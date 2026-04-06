import { apiFetch } from './game/api.js';
import { createRuntimeContext } from './game/context.js';
import { createUiController } from './game/ui.js';
import { createSettingsController } from './game/settings.js';
import { createPlaybackController } from './game/playback.js';
import { createDecisionController } from './game/decisions.js';
import { createSceneController } from './game/scene.js';
import { createAppController } from './game/app.js';

const ctx = createRuntimeContext();
const ui = createUiController(ctx);
const settingsController = createSettingsController(ctx, { apiFetch });
const playback = createPlaybackController(ctx, ui);
const decisions = createDecisionController(ctx, ui, playback);
const scene = createSceneController(ctx, {
  apiFetch,
  localeQueryString: settingsController.localeQueryString,
  ui,
  playback,
  decisions,
});
const app = createAppController(ctx, {
  apiFetch,
  settingsController,
  ui,
  playback,
  decisions,
  scene,
});

app.boot();
