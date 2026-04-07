export function createAppController(ctx, { apiFetch, settingsController, ui, playback, decisions, scene }) {
  async function loadProjectInfo() {
    try {
      const { projectName } = await apiFetch('/api/game/info');
      if (projectName) {
        const titleEl = ctx.$('menu-title');
        if (titleEl) titleEl.textContent = projectName;
        document.title = projectName + ' — Interactive Video';
      }
    } catch {}
  }

  async function checkContinue() {
    try {
      const { hasSave } = await apiFetch('/api/game/has-save');
      ctx.$('btn-continue').disabled = !hasSave;
    } catch {
      ctx.$('btn-continue').disabled = true;
    }
  }

  function pauseGame() {
    ctx.state.gamePaused = true;
    playback.pauseVideo();
    ctx.dom.musicEl.pause();
    playback.pauseAmbient();
    decisions.clearCountdown();
    playback.stopSubtitleSync();
    ui.showScreen('paused');
  }

  function resumeGame() {
    ctx.state.gamePaused = false;
    ui.showScreen('game');
    if (ctx.dom.transEl.classList.contains('active')) {
      ctx.dom.transEl.play().catch(() => {});
    } else {
      ctx.dom.videoEl.play().catch(() => {});
    }
    if (ctx.settings.musicEnabled && ctx.dom.musicEl.src) ctx.dom.musicEl.play().catch(() => {});
    playback.resumeAmbient();
    playback.startSubtitleSync();
  }

  function closeSettings() {
    settingsController.saveSettings();
    settingsController.applySettings();
    ui.showScreen(ctx.state.settingsReturnTo);
  }

  function bindUiEvents() {
    ctx.$('btn-continue').addEventListener('click', async () => {
      ui.showScreen('game');
      ui.showSpinner('Loading…');
      try {
        const state = await apiFetch('/api/game/state' + settingsController.localeQueryString());
        await scene.loadScene(state, { restoreAmbientState: true });
      } catch (error) {
        ui.showError('Failed to load: ' + (error.message || error));
      }
    });

    ctx.$('btn-new-game').addEventListener('click', async () => {
      ui.showScreen('game');
      await scene.restartGame();
    });

    ctx.$('btn-menu-settings').addEventListener('click', () => {
      ctx.state.settingsReturnTo = 'menu';
      ui.showScreen('settings');
    });

    ctx.dom.pauseBtn.addEventListener('click', () => pauseGame());

    ctx.$('btn-resume').addEventListener('click', () => resumeGame());

    ctx.$('btn-pause-settings').addEventListener('click', () => {
      ctx.state.settingsReturnTo = 'paused';
      ui.showScreen('settings');
    });

    ctx.$('btn-quit-menu').addEventListener('click', () => {
      resumeGame();
      playback.pauseVideo();
      ui.showScreen('menu');
      checkContinue();
    });

    ctx.$('btn-settings-close').addEventListener('click', () => {
      closeSettings();
    });

    ctx.$('end-restart').addEventListener('click', async () => {
      ctx.dom.endScreen.classList.remove('visible');
      await scene.restartGame();
    });

    ctx.$('end-menu').addEventListener('click', () => {
      ctx.dom.endScreen.classList.remove('visible');
      playback.stopMusic();
      playback.stopAmbient();
      ui.showScreen('menu');
      checkContinue();
    });

    ctx.$('error-retry').addEventListener('click', () => location.reload());

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;

        if (ctx.state.appScreen === 'game') pauseGame();
        else if (ctx.state.appScreen === 'paused') resumeGame();
        else if (ctx.state.appScreen === 'settings') closeSettings();
        return;
      }

      if (event.repeat) {
        return;
      }

      if (ctx.state.appScreen !== 'game' || ctx.state.gamePaused || ctx.state.decisionMade) {
        return;
      }

      const decision = decisions.findDecisionByKey(event.key);
      if (!decision) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      ctx.state.decisionMade = true;
      decisions.clearCountdown();
      decisions.hideDecisions();
      scene.makeDecision(decision.key);
    });
  }

  async function boot() {
    settingsController.loadSettings();
    settingsController.applySettings();
    settingsController.bindSettingsControls();
    bindUiEvents();
    ui.showScreen('menu');
    await Promise.all([checkContinue(), settingsController.loadLocales(), loadProjectInfo()]);
  }

  return {
    boot,
    checkContinue,
    closeSettings,
    pauseGame,
    resumeGame,
  };
}
