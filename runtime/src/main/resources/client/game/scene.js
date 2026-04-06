export function createSceneController(ctx, { apiFetch, localeQueryString, ui, playback, decisions }) {
  async function loadScene(state) {
    ctx.state.currentState = state;
    ctx.state.decisionMade = false;
    decisions.clearActiveDecisionHotkeys();

    ui.clearSceneVideoListeners();
    ctx.state.loopHandler = null;

    decisions.hideDecisions();
    decisions.hideCountdown();
    playback.stopSubtitleSync();
    ctx.dom.endScreen.classList.remove('visible');

    if (ctx.dom.freezeCanvas.style.display === 'none') ui.showSpinner('Loading…');

    if (ctx.state.hlsInstance) {
      ctx.state.hlsInstance.destroy();
      ctx.state.hlsInstance = null;
    }

    const sceneUrl = state.sceneHlsUrl;
    if (ctx.state.preloadedSceneHls[sceneUrl]) {
      ctx.state.preloadedSceneHls[sceneUrl].destroy();
      delete ctx.state.preloadedSceneHls[sceneUrl];
    }

    await playback.loadHls(ctx.dom.videoEl, sceneUrl, (hls) => {
      ctx.state.hlsInstance = hls;
    });

    ctx.dom.videoEl.volume = ctx.settings.videoVolume;

    playback.preloadTransitions(state.preloadUrls || []);
    if (state.autoContinueNextSceneUrl) {
      playback.preloadScene(state.autoContinueNextSceneUrl);
    }

    playback.updateMusic(state.musicUrl);
    playback.setSubtitles(state.subtitles || []);

    const loopVideo = !!state.loopVideo;
    ctx.dom.videoEl.loop = false;

    const availableDecisions = state.decisions || [];
    const hasExplicitDecisions = !!state.hasExplicitDecisions;
    const timeoutSeconds = state.decisionTimeoutSecs || 5;
    const isEnd = state.isEnd;

    if (state.autoContinue) {
      ui.addSceneVideoListener('ended', async () => {
        ui.captureFreeze();
        if (!ctx.state.decisionMade) {
          ctx.state.decisionMade = true;
          await makeDecision('CONTINUE');
        }
      }, { once: true });
    } else {
      let appearAt = null;
      try {
        if (state.decisionAppearanceConfig) {
          const config = JSON.parse(state.decisionAppearanceConfig);
          if (config.timing === 'at_timestamp' && typeof config.timestamp === 'number') {
            appearAt = config.timestamp;
          }
        }
      } catch {}

      if (availableDecisions.length > 0) {
        if (appearAt !== null) {
          ui.addSceneVideoListener('timeupdate', function onTimeUpdate() {
            if (ctx.dom.videoEl.currentTime >= appearAt) {
              ctx.dom.videoEl.removeEventListener('timeupdate', onTimeUpdate);
              if (!ctx.state.decisionMade) decisions.showDecisions(availableDecisions, timeoutSeconds, makeDecision);
            }
          });
        }

        if (loopVideo) {
          let decisionsShown = false;
          ctx.state.loopHandler = function onLoop() {
            if (ctx.state.decisionMade) {
              ctx.dom.videoEl.removeEventListener('ended', ctx.state.loopHandler);
              ctx.state.loopHandler = null;
              return;
            }
            if (isEnd) {
              ctx.dom.videoEl.removeEventListener('ended', ctx.state.loopHandler);
              ctx.state.loopHandler = null;
              ui.captureFreeze();
              ui.showEndScreen();
              return;
            }
            if (!decisionsShown && appearAt === null) {
              decisionsShown = true;
              decisions.showDecisions(availableDecisions, timeoutSeconds, makeDecision);
            }
            if (ctx.state.hlsInstance) ctx.state.hlsInstance.startLoad(0);
            ctx.dom.videoEl.currentTime = 0;
            ctx.dom.videoEl.play().catch(() => {});
          };
          ui.addSceneVideoListener('ended', ctx.state.loopHandler);
        } else {
          ui.addSceneVideoListener('ended', function onEnded() {
            ctx.dom.videoEl.removeEventListener('ended', onEnded);
            ui.captureFreeze();
            if (isEnd) {
              ui.showEndScreen();
              return;
            }
            if (!ctx.state.decisionMade) decisions.showDecisions(availableDecisions, timeoutSeconds, makeDecision);
          }, { once: true });
        }
      } else if (hasExplicitDecisions) {
        if (appearAt !== null) {
          ui.addSceneVideoListener('timeupdate', function onTimeUpdate() {
            if (ctx.dom.videoEl.currentTime >= appearAt) {
              ctx.dom.videoEl.removeEventListener('timeupdate', onTimeUpdate);
              decisions.showUnavailableDecisionsError();
            }
          });
        }

        if (loopVideo) {
          let unavailableShown = false;
          ctx.state.loopHandler = function onLoop() {
            if (ctx.state.decisionMade) {
              ctx.dom.videoEl.removeEventListener('ended', ctx.state.loopHandler);
              ctx.state.loopHandler = null;
              return;
            }
            if (isEnd) {
              ctx.dom.videoEl.removeEventListener('ended', ctx.state.loopHandler);
              ctx.state.loopHandler = null;
              ui.captureFreeze();
              ui.showEndScreen();
              return;
            }
            if (!unavailableShown && appearAt === null) {
              unavailableShown = true;
              decisions.showUnavailableDecisionsError();
              return;
            }
            if (ctx.state.hlsInstance) ctx.state.hlsInstance.startLoad(0);
            ctx.dom.videoEl.currentTime = 0;
            ctx.dom.videoEl.play().catch(() => {});
          };
          ui.addSceneVideoListener('ended', ctx.state.loopHandler);
        } else {
          ui.addSceneVideoListener('ended', function onEnded() {
            ctx.dom.videoEl.removeEventListener('ended', onEnded);
            if (!ctx.state.decisionMade) decisions.showUnavailableDecisionsError();
          }, { once: true });
        }
      } else if (isEnd) {
        ui.addSceneVideoListener('ended', () => {
          ui.captureFreeze();
          ui.showEndScreen();
        }, { once: true });
      } else {
        ui.addSceneVideoListener('ended', async () => {
          ui.captureFreeze();
          await makeDecision('CONTINUE');
        }, { once: true });
      }
    }

    ctx.dom.videoEl.play().catch(() => {});
    await new Promise((resolve) => {
      if (ctx.dom.videoEl.readyState >= 3) {
        resolve();
        return;
      }
      ctx.dom.videoEl.addEventListener('playing', resolve, { once: true });
      setTimeout(resolve, 1000);
    });

    ui.hideSpinner();
    ui.hideFreeze();
    playback.startSubtitleSync();
  }

  async function makeDecision(decisionKey) {
    ui.captureFreeze();
    ctx.dom.videoEl.loop = false;
    ctx.dom.videoEl.pause();
    playback.stopSubtitleSync();
    try {
      const result = await apiFetch('/api/game/decide' + localeQueryString(), {
        method: 'POST',
        body: JSON.stringify({ decisionKey }),
      });

      if (result.transition) {
        await playback.playTransition(result.transition);
      }

      await loadScene(result.nextState);
    } catch (error) {
      ui.showError('Error: ' + (error.message || error));
    }
  }

  async function restartGame() {
    decisions.clearCountdown();
    decisions.hideDecisions();
    ui.hideFreeze();
    ctx.dom.endScreen.classList.remove('visible');
    ui.showSpinner('Restarting…');

    playback.resetPlaybackState();
    playback.stopMusic();

    try {
      const state = await apiFetch('/api/game/restart' + localeQueryString(), {
        method: 'POST',
        body: '{}',
      });
      await loadScene(state);
    } catch (error) {
      ui.showError('Restart failed: ' + (error.message || error));
    }
  }

  return {
    loadScene,
    makeDecision,
    restartGame,
  };
}
