export function createSceneController(ctx, { apiFetch, localeQueryString, ui, playback, decisions }) {
  async function loadScene(state, options = {}) {
    const restoreAmbientState = !!options.restoreAmbientState
    ctx.state.currentState = state;
    ctx.state.decisionMade = true;
    decisions.clearActiveDecisionHotkeys();

    ui.clearSceneVideoListeners();
    ctx.state.loopHandler = null;

    decisions.hideDecisions();
    decisions.hideCountdown();
    playback.stopSubtitleSync();
    ctx.dom.endScreen.classList.remove('visible');

    const sceneUrl = state.sceneHlsUrl;
    const preparedSceneMatches = ctx.state.preparedSceneUrl === sceneUrl;
    const canReusePreparedScene = preparedSceneMatches && ctx.state.preparedSceneReady && ctx.state.hlsInstance;

    if (!canReusePreparedScene && ctx.dom.freezeCanvas.style.display === 'none') ui.showSpinner('Loading…');

    if (!canReusePreparedScene) {
      if (preparedSceneMatches && ctx.state.preparedScenePromise) {
        try {
          await ctx.state.preparedScenePromise;
        } catch {}
      }

      if (!(ctx.state.preparedSceneUrl === sceneUrl && ctx.state.preparedSceneReady && ctx.state.hlsInstance)) {
        if (ctx.state.hlsInstance) {
          ctx.state.hlsInstance.destroy();
          ctx.state.hlsInstance = null;
        }

        const preloadedScene = ctx.state.preloadedSceneHls[sceneUrl];
        if (preloadedScene?.promise) {
          await preloadedScene.promise;
          delete ctx.state.preloadedSceneHls[sceneUrl];
        }

        await playback.loadHls(ctx.dom.videoEl, sceneUrl, (hls) => {
          ctx.state.hlsInstance = hls;
        });
      }
    }

    ctx.state.preparedSceneUrl = null;
    ctx.state.preparedScenePromise = null;
    ctx.state.preparedSceneReady = false;

    ctx.dom.videoEl.volume = ctx.settings.videoVolume;

    playback.preloadTransitions(state.preloadUrls || []);
    playback.preloadScenes([
      ...(state.preloadSceneUrls || []),
      state.autoContinueNextSceneUrl,
    ].filter(Boolean));

    playback.updateMusic(state.musicUrl);
    playback.setSubtitles(state.subtitles || []);
    if (restoreAmbientState) {
      playback.restoreAmbientState(state.ambient || state.sceneAmbient || { action: 'stop' })
    } else {
      playback.applyAmbientDirective(state.sceneAmbient || { action: 'inherit' })
    }

    const loopVideo = !!state.loopVideo;
    ctx.dom.videoEl.loop = loopVideo;

    const availableDecisions = state.decisions || [];
    const hasExplicitDecisions = !!state.hasExplicitDecisions;
    const hasContinueDecision = availableDecisions.some((decision) => decision.key === 'CONTINUE');
    const sceneDuration = typeof state.duration === 'number' && Number.isFinite(state.duration)
      ? state.duration
      : null;
    const timeoutSeconds = state.decisionTimeoutSecs || 5;
    const isEnd = state.isEnd;
    const loopDecisionLeadSeconds = 0.75;
    ctx.state.decisionMade = false;

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

      const addLoopBoundaryHandler = (callback) => {
        ui.addSceneVideoListener('timeupdate', function onLoopBoundary() {
          if (ctx.state.decisionMade) {
            ctx.dom.videoEl.removeEventListener('timeupdate', onLoopBoundary);
            return;
          }
          const duration = Number.isFinite(ctx.dom.videoEl.duration) && ctx.dom.videoEl.duration > 0
            ? ctx.dom.videoEl.duration
            : sceneDuration;
          if (!Number.isFinite(duration) || duration <= 0) return;
          if (ctx.dom.videoEl.currentTime >= Math.max(0, duration - loopDecisionLeadSeconds)) {
            ctx.dom.videoEl.removeEventListener('timeupdate', onLoopBoundary);
            callback();
          }
        });
      };

      if (availableDecisions.length > 0) {
        if (appearAt !== null) {
          ui.addSceneVideoListener('timeupdate', function onTimeUpdate() {
            if (ctx.dom.videoEl.currentTime >= appearAt) {
              ctx.dom.videoEl.removeEventListener('timeupdate', onTimeUpdate);
              if (!ctx.state.decisionMade) {
                decisions.showDecisions(availableDecisions, timeoutSeconds, makeDecision);
              }
            }
          });
        }

        if (loopVideo) {
          if (appearAt === null) {
            addLoopBoundaryHandler(() => {
              if (!ctx.state.decisionMade) {
                decisions.showDecisions(availableDecisions, timeoutSeconds, makeDecision);
              }
            });
          }
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
          if (appearAt === null) {
            addLoopBoundaryHandler(() => {
              if (!ctx.state.decisionMade) {
                decisions.showUnavailableDecisionsError();
              }
            });
          }
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
      } else if (hasContinueDecision) {
        ui.addSceneVideoListener('ended', async () => {
          ui.captureFreeze();
          await makeDecision('CONTINUE');
        }, { once: true });
      } else {
        ui.addSceneVideoListener('ended', () => {
          if (!ctx.state.decisionMade) {
            decisions.showUnavailableDecisionsError();
          }
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
    await playback.waitForVisibleFrame(ctx.dom.videoEl, 1000);

    ui.hideSpinner();
    ui.hideFreeze();
    playback.startSubtitleSync();
  }

  async function makeDecision(decisionKey) {
    const keepLoopingSceneVisible = ctx.dom.videoEl.loop && !ctx.dom.videoEl.paused && ctx.dom.freezeCanvas.style.display === 'none';
    if (!keepLoopingSceneVisible) {
      ui.captureFreeze();
      ctx.dom.videoEl.loop = false;
      ctx.dom.videoEl.pause();
    }
    playback.stopSubtitleSync();
    ui.clearSceneVideoListeners();
    ctx.state.loopHandler = null;
    try {
      const result = await apiFetch('/api/game/decide' + localeQueryString(), {
        method: 'POST',
        body: JSON.stringify({ decisionKey }),
      });

      let prepareScenePromise = null;
      const nextSceneUrl = result.nextState?.sceneHlsUrl || null;
      const preloadScenePromise = nextSceneUrl
        ? playback.preloadScene(nextSceneUrl)
        : Promise.resolve();

      playback.applyAmbientDirective(result.edgeAmbient || { action: 'inherit' })

      if (result.transition) {
        await playback.playTransition(result.transition, {
          onShown: () => {
            ctx.dom.videoEl.loop = false;
            ctx.dom.videoEl.pause();
            if (nextSceneUrl) {
              prepareScenePromise = playback.prepareScene(nextSceneUrl).catch(() => null);
            }
          },
        });
      } else if (keepLoopingSceneVisible) {
        await preloadScenePromise;
        ui.captureFreeze();
        ctx.dom.videoEl.loop = false;
        ctx.dom.videoEl.pause();
      }

      if (prepareScenePromise) {
        await prepareScenePromise;
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
