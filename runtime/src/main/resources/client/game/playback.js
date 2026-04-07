export function createPlaybackController(ctx, ui) {
  function getHlsCtor() {
    return window.Hls;
  }

  function updateMusic(musicUrl) {
    if (musicUrl === undefined || musicUrl === null) return;
    if (musicUrl === ctx.state.currentMusicUrl) return;

    ctx.state.currentMusicUrl = musicUrl;

    if (!musicUrl) {
      stopMusic();
      return;
    }

    ctx.dom.musicEl.src = musicUrl;
    ctx.dom.musicEl.volume = ctx.settings.musicEnabled ? ctx.settings.musicVolume : 0;
    if (ctx.settings.musicEnabled) {
      ctx.dom.musicEl.play().catch(() => {});
    }
  }

  function stopMusic() {
    ctx.dom.musicEl.pause();
    ctx.dom.musicEl.removeAttribute('src');
    ctx.dom.musicEl.load();
    ctx.state.currentMusicUrl = null;
  }

  function clamp01(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(1, numeric));
  }

  function ambientTargetVolume(baseVolume) {
    return clamp01((baseVolume ?? 1) * (ctx.settings.ambientVolume ?? 1));
  }

  function cancelAmbientFade() {
    ctx.state.ambientFadeToken += 1;
    if (ctx.state.ambientFadeRafId) {
      cancelAnimationFrame(ctx.state.ambientFadeRafId);
      ctx.state.ambientFadeRafId = null;
    }
  }

  function animateAmbientVolume(from, to, durationMs, onComplete) {
    cancelAmbientFade();
    if (!(durationMs > 0)) {
      ctx.dom.ambientEl.volume = clamp01(to);
      if (onComplete) onComplete();
      return;
    }
    const token = ctx.state.ambientFadeToken;
    const start = performance.now();
    const tick = (now) => {
      if (token !== ctx.state.ambientFadeToken) return;
      const progress = Math.min(1, (now - start) / durationMs);
      ctx.dom.ambientEl.volume = clamp01(from + ((to - from) * progress));
      if (progress < 1) {
        ctx.state.ambientFadeRafId = requestAnimationFrame(tick);
        return;
      }
      ctx.state.ambientFadeRafId = null;
      if (onComplete) onComplete();
    };
    ctx.state.ambientFadeRafId = requestAnimationFrame(tick);
  }

  function clearAmbientElement() {
    cancelAmbientFade();
    ctx.dom.ambientEl.pause();
    ctx.dom.ambientEl.loop = false;
    ctx.dom.ambientEl.removeAttribute('src');
    ctx.dom.ambientEl.load();
    ctx.dom.ambientEl.volume = 0;
    ctx.state.currentAmbient = null;
  }

  function refreshAmbientVolume() {
    if (!ctx.state.currentAmbient) {
      ctx.dom.ambientEl.volume = 0;
      return;
    }
    ctx.dom.ambientEl.volume = ambientTargetVolume(ctx.state.currentAmbient.volume);
  }

  function stopAmbient(fadeMs = 0) {
    if (!ctx.dom.ambientEl.src) {
      clearAmbientElement();
      return;
    }
    if (!(fadeMs > 0)) {
      clearAmbientElement();
      return;
    }
    ctx.state.currentAmbient = null;
    animateAmbientVolume(ctx.dom.ambientEl.volume, 0, fadeMs, () => {
      clearAmbientElement();
    });
  }

  function startAmbientTrack(ambient) {
    cancelAmbientFade();
    ctx.dom.ambientEl.pause();
    ctx.dom.ambientEl.src = ambient.assetUrl;
    ctx.dom.ambientEl.loop = ambient.loop !== false;
    ctx.dom.ambientEl.load();
    ctx.state.currentAmbient = ambient;

    const targetVolume = ambientTargetVolume(ambient.volume);
    if (ambient.fadeMs > 0) {
      ctx.dom.ambientEl.volume = 0;
    } else {
      ctx.dom.ambientEl.volume = targetVolume;
    }

    if (ctx.state.appScreen === 'game' && !ctx.state.gamePaused) {
      ctx.dom.ambientEl.play().catch(() => {});
    }

    if (ambient.fadeMs > 0) {
      animateAmbientVolume(0, targetVolume, ambient.fadeMs);
    }
  }

  function applyAmbientDirective(ambient, options = {}) {
    const force = !!options.force;
    if (!ambient) return;
    if (ambient.action === 'inherit') {
      const currentAmbient = ctx.state.currentAmbient;
      if (!currentAmbient) return;
      const nextAmbient = {
        ...currentAmbient,
        volume: ambient.volume != null ? clamp01(ambient.volume) : currentAmbient.volume,
        fadeMs: Math.max(0, Number.isFinite(ambient.fadeMs) ? ambient.fadeMs : (currentAmbient.fadeMs ?? 0)),
      };
      ctx.state.currentAmbient = nextAmbient;
      const targetVolume = ambientTargetVolume(nextAmbient.volume);
      if (nextAmbient.fadeMs > 0) {
        animateAmbientVolume(ctx.dom.ambientEl.volume, targetVolume, nextAmbient.fadeMs);
      } else {
        cancelAmbientFade();
        ctx.dom.ambientEl.volume = targetVolume;
      }
      if (ctx.state.appScreen === 'game' && !ctx.state.gamePaused && ctx.dom.ambientEl.paused && ctx.dom.ambientEl.src) {
        ctx.dom.ambientEl.play().catch(() => {});
      }
      return;
    }
    if (ambient.action === 'stop') {
      stopAmbient(ambient.fadeMs ?? 0);
      return;
    }
    if (ambient.action !== 'set' || !ambient.assetUrl) {
      stopAmbient(ambient?.fadeMs ?? 0);
      return;
    }

    const nextAmbient = {
      action: 'set',
      zoneId: ambient.zoneId ?? null,
      assetUrl: ambient.assetUrl,
      volume: clamp01(ambient.volume ?? 1),
      fadeMs: Math.max(0, Number.isFinite(ambient.fadeMs) ? ambient.fadeMs : 0),
      loop: ambient.loop !== false,
    };

    const currentAmbient = ctx.state.currentAmbient;
    if (!force && currentAmbient && currentAmbient.assetUrl === nextAmbient.assetUrl) {
      ctx.state.currentAmbient = { ...currentAmbient, ...nextAmbient };
      ctx.dom.ambientEl.loop = nextAmbient.loop;
      const targetVolume = ambientTargetVolume(nextAmbient.volume);
      if (nextAmbient.fadeMs > 0) {
        animateAmbientVolume(ctx.dom.ambientEl.volume, targetVolume, nextAmbient.fadeMs);
      } else {
        cancelAmbientFade();
        ctx.dom.ambientEl.volume = targetVolume;
      }
      if (ctx.state.appScreen === 'game' && !ctx.state.gamePaused && ctx.dom.ambientEl.paused) {
        ctx.dom.ambientEl.play().catch(() => {});
      }
      return;
    }

    if (!force && currentAmbient && ctx.dom.ambientEl.src && nextAmbient.fadeMs > 0) {
      const fadeOutMs = Math.max(1, Math.round(nextAmbient.fadeMs / 2));
      const fadeInMs = Math.max(0, nextAmbient.fadeMs - fadeOutMs);
      animateAmbientVolume(ctx.dom.ambientEl.volume, 0, fadeOutMs, () => {
        startAmbientTrack({ ...nextAmbient, fadeMs: fadeInMs });
      });
      return;
    }

    startAmbientTrack(nextAmbient);
  }

  function restoreAmbientState(ambient) {
    applyAmbientDirective(ambient);
  }

  function pauseAmbient() {
    if (ctx.dom.ambientEl.src) {
      ctx.dom.ambientEl.pause();
    }
  }

  function resumeAmbient() {
    if (ctx.state.currentAmbient && ctx.dom.ambientEl.src && ctx.state.appScreen === 'game' && !ctx.state.gamePaused) {
      ctx.dom.ambientEl.play().catch(() => {});
    }
  }

  function setSubtitles(subtitles) {
    ctx.state.currentSubtitles = (subtitles || []).slice().sort((a, b) => a.startTime - b.startTime);
    if (ctx.dom.subtitleText) ctx.dom.subtitleText.textContent = '';
  }

  function stopSubtitleSync() {
    if (ctx.state.subtitleRafId) {
      cancelAnimationFrame(ctx.state.subtitleRafId);
      ctx.state.subtitleRafId = null;
    }
    if (ctx.dom.subtitleText) ctx.dom.subtitleText.textContent = '';
  }

  function startSubtitleSync() {
    stopSubtitleSync();
    if (!ctx.state.currentSubtitles.length || !ctx.settings.subtitlesEnabled) return;

    function tick() {
      const currentTime = ctx.dom.videoEl.currentTime;
      let found = '';
      for (const subtitle of ctx.state.currentSubtitles) {
        if (currentTime >= subtitle.startTime && currentTime < subtitle.endTime) {
          found = subtitle.text;
          break;
        }
      }
      if (ctx.dom.subtitleText) ctx.dom.subtitleText.textContent = found;
      ctx.state.subtitleRafId = requestAnimationFrame(tick);
    }

    ctx.state.subtitleRafId = requestAnimationFrame(tick);
  }

  function pauseVideo() {
    ctx.dom.videoEl.pause();
    ctx.dom.transEl.pause();
  }

  function clearPreparedSceneState() {
    ctx.state.preparedSceneUrl = null;
    ctx.state.preparedScenePromise = null;
    ctx.state.preparedSceneReady = false;
  }

  function prepareScene(sceneUrl) {
    if (!sceneUrl) {
      clearPreparedSceneState();
      return Promise.resolve();
    }

    if (ctx.state.preparedSceneUrl === sceneUrl && ctx.state.preparedScenePromise) {
      return ctx.state.preparedScenePromise;
    }

    clearPreparedSceneState();
    ctx.state.preparedSceneUrl = sceneUrl;

    const promise = (async () => {
      if (ctx.state.hlsInstance) {
        ctx.state.hlsInstance.destroy();
        ctx.state.hlsInstance = null;
      }

      const preloadedScene = ctx.state.preloadedSceneHls[sceneUrl];
      if (preloadedScene?.promise) {
        await preloadedScene.promise;
        delete ctx.state.preloadedSceneHls[sceneUrl];
      }

      await loadHls(ctx.dom.videoEl, sceneUrl, (hls) => {
        ctx.state.hlsInstance = hls;
      });

      ctx.dom.videoEl.defaultMuted = false;
      ctx.dom.videoEl.muted = false;
      ctx.dom.videoEl.volume = ctx.settings.videoVolume;
      ctx.dom.videoEl.pause();
      ctx.state.preparedSceneReady = true;
    })().catch((error) => {
      if (ctx.state.hlsInstance) {
        ctx.state.hlsInstance.destroy();
        ctx.state.hlsInstance = null;
      }
      clearPreparedSceneState();
      throw error;
    });

    ctx.state.preparedScenePromise = promise;
    return promise;
  }

  function prefetchResource(url, controller, asText = false) {
    return fetch(url, {
      signal: controller.signal,
      credentials: 'same-origin',
    }).then((response) => {
      if (!response.ok) throw new Error('Prefetch failed: ' + response.status);
      return asText ? response.text() : response.arrayBuffer();
    });
  }

  function parseUriAttribute(line, key) {
    const match = line.match(new RegExp(key + '="([^"]+)"'));
    return match ? match[1] : null;
  }

  function syncPreloadedStore(store, keepUrls) {
    const keep = new Set((keepUrls || []).filter(Boolean));
    for (const [url, entry] of Object.entries(store)) {
      if (keep.has(url)) continue;
      entry?.controller?.abort?.();
      delete store[url];
    }
  }

  function prefetchHls(url, store) {
    if (!url || store[url]) return;

    const controller = new AbortController();
    const promise = (async () => {
      const queue = [new URL(url, window.location.href).toString()];
      const visited = new Set();

      while (queue.length) {
        const currentUrl = queue.shift();
        if (!currentUrl || visited.has(currentUrl)) continue;
        visited.add(currentUrl);

        const text = await prefetchResource(currentUrl, controller, true);
        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        let firstSegmentUrl = null;

        for (const line of lines) {
          if (line.startsWith('#EXT-X-MAP:')) {
            const mapUri = parseUriAttribute(line, 'URI');
            if (mapUri) {
              await prefetchResource(new URL(mapUri, currentUrl).toString(), controller);
            }
            continue;
          }

          if (line.startsWith('#')) continue;

          const resolvedUrl = new URL(line, currentUrl).toString();
          if (line.endsWith('.m3u8')) {
            queue.push(resolvedUrl);
            continue;
          }

          if (!firstSegmentUrl) {
            firstSegmentUrl = resolvedUrl;
          }
        }

        if (firstSegmentUrl) {
          await prefetchResource(firstSegmentUrl, controller);
        }
      }
    })().catch(() => {});

    store[url] = { controller, promise };
  }

  function loadHls(videoElement, src, onReady) {
    return new Promise((resolve, reject) => {
      const HlsCtor = getHlsCtor();

      function attachNative() {
        videoElement.src = src;
        videoElement.addEventListener('canplay', () => {
          if (onReady) onReady(null);
          resolve();
        }, { once: true });
        videoElement.addEventListener('error', (event) => reject(new Error('Video error: ' + event.message)), { once: true });
      }

      if (!HlsCtor || !HlsCtor.isSupported()) {
        attachNative();
        return;
      }

      const hls = new HlsCtor({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 0,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
      });
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };

      hls.loadSource(src);
      hls.attachMedia(videoElement);
      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        if (onReady) onReady(hls);
      });
      hls.on(HlsCtor.Events.FRAG_BUFFERED, finish);
      videoElement.addEventListener('canplay', finish, { once: true });
      hls.on(HlsCtor.Events.ERROR, (_, data) => {
        if (data.fatal) {
          hls.destroy();
          if (!done) {
            done = true;
            reject(new Error('HLS fatal error: ' + data.type));
          }
        }
      });
      setTimeout(finish, 10000);
    });
  }

  function preloadTransitions(urls) {
    syncPreloadedStore(ctx.state.preloadedHls, urls);

    for (const url of urls) {
      prefetchHls(url, ctx.state.preloadedHls);
    }
  }

  function preloadScenes(urls) {
    const uniqueUrls = [...new Set((urls || []).filter(Boolean))];
    syncPreloadedStore(ctx.state.preloadedSceneHls, uniqueUrls);
    for (const url of uniqueUrls) {
      prefetchHls(url, ctx.state.preloadedSceneHls);
    }
  }

  function preloadScene(url) {
    preloadScenes(url ? [url] : []);
  }

  async function playTransition(transition) {
    if (ctx.state.transHls) {
      ctx.state.transHls.destroy();
      ctx.state.transHls = null;
    }

    ctx.dom.transEl.pause();
    ctx.dom.transEl.removeAttribute('src');
    ctx.dom.transEl.load();

    const url = transition.transitionHlsUrl;

    await loadHls(ctx.dom.transEl, url, (hls) => {
      ctx.state.transHls = hls;
    });

    ui.hideSpinner();
    ui.hideFreeze();
    ctx.dom.transEl.classList.add('active');
    ctx.dom.transEl.defaultMuted = false;
    ctx.dom.transEl.muted = false;
    ctx.dom.transEl.volume = ctx.settings.videoVolume;
    ctx.dom.transEl.style.backgroundColor = transition.backgroundColor || '';
    ctx.dom.transEl.play().catch(() => {});

    return new Promise((resolve) => {
      let cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        const preparedSceneReady = ctx.state.preparedSceneReady;
        if (!preparedSceneReady) {
          ui.captureFreezeFrom(ctx.dom.transEl);
        }
        ctx.dom.transEl.pause();
        ctx.dom.transEl.classList.remove('active');
        ctx.dom.transEl.style.backgroundColor = '';
        if (ctx.state.transHls) {
          ctx.state.transHls.destroy();
          ctx.state.transHls = null;
        }
        ctx.dom.transEl.removeAttribute('src');
        ctx.dom.transEl.load();
        if (preparedSceneReady) {
          ui.hideFreeze();
        }
        resolve();
      }
      ctx.dom.transEl.addEventListener('ended', cleanup, { once: true });
      setTimeout(cleanup, ((transition.duration || 2) + 1) * 1000);
    });
  }

  function resetPlaybackState() {
    if (ctx.state.hlsInstance) {
      ctx.state.hlsInstance.destroy();
      ctx.state.hlsInstance = null;
    }
    if (ctx.state.transHls) {
      ctx.state.transHls.destroy();
      ctx.state.transHls = null;
    }
    ctx.dom.transEl.pause();
    ctx.dom.transEl.classList.remove('active');
    ctx.dom.transEl.style.backgroundColor = '';
    ctx.dom.transEl.removeAttribute('src');
    ctx.dom.transEl.load();
    clearPreparedSceneState();
    syncPreloadedStore(ctx.state.preloadedHls, []);
    syncPreloadedStore(ctx.state.preloadedSceneHls, []);
    stopAmbient(0);
  }

  return {
    applyAmbientDirective,
    loadHls,
    pauseVideo,
    pauseAmbient,
    playTransition,
    prepareScene,
    preloadScene,
    preloadScenes,
    preloadTransitions,
    refreshAmbientVolume,
    resetPlaybackState,
    restoreAmbientState,
    resumeAmbient,
    setSubtitles,
    stopAmbient,
    startSubtitleSync,
    stopMusic,
    stopSubtitleSync,
    updateMusic,
  };
}
