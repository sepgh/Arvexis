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

      const hls = new HlsCtor({ enableWorker: false, lowLatencyMode: false });
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
    const HlsCtor = getHlsCtor();

    for (const key of Object.keys(ctx.state.preloadedHls)) {
      if (!urls.includes(key)) {
        ctx.state.preloadedHls[key]?.destroy?.();
        delete ctx.state.preloadedHls[key];
      }
    }

    for (const url of urls) {
      if (ctx.state.preloadedHls[url]) continue;
      if (!HlsCtor || !HlsCtor.isSupported()) continue;

      const hls = new HlsCtor({ enableWorker: false });
      const dummy = document.createElement('video');
      dummy.muted = true;
      hls.loadSource(url);
      hls.attachMedia(dummy);
      ctx.state.preloadedHls[url] = hls;
    }
  }

  function preloadScene(url) {
    const HlsCtor = getHlsCtor();

    if (ctx.state.preloadedSceneHls[url]) return;
    if (!HlsCtor || !HlsCtor.isSupported()) return;

    const hls = new HlsCtor({ enableWorker: false });
    const dummy = document.createElement('video');
    dummy.muted = true;
    hls.loadSource(url);
    hls.attachMedia(dummy);
    ctx.state.preloadedSceneHls[url] = hls;
  }

  async function playTransition(transition) {
    if (ctx.state.transHls) {
      ctx.state.transHls.destroy();
      ctx.state.transHls = null;
    }

    const url = transition.transitionHlsUrl;
    if (ctx.state.preloadedHls[url]) {
      ctx.state.preloadedHls[url].destroy();
      delete ctx.state.preloadedHls[url];
    }

    await loadHls(ctx.dom.transEl, url, (hls) => {
      ctx.state.transHls = hls;
    });

    ui.hideSpinner();
    ctx.dom.transEl.style.backgroundColor = transition.backgroundColor || '';
    ctx.dom.transEl.classList.add('active');
    ctx.dom.transEl.play().catch(() => {});

    return new Promise((resolve) => {
      let cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        ui.captureFreezeFrom(ctx.dom.transEl);
        ctx.dom.transEl.pause();
        ctx.dom.transEl.classList.remove('active');
        ctx.dom.transEl.style.backgroundColor = '';
        if (ctx.state.transHls) {
          ctx.state.transHls.destroy();
          ctx.state.transHls = null;
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
    for (const hls of Object.values(ctx.state.preloadedHls)) hls?.destroy?.();
    ctx.state.preloadedHls = {};
    for (const hls of Object.values(ctx.state.preloadedSceneHls)) hls?.destroy?.();
    ctx.state.preloadedSceneHls = {};
  }

  return {
    loadHls,
    pauseVideo,
    playTransition,
    preloadScene,
    preloadTransitions,
    resetPlaybackState,
    setSubtitles,
    startSubtitleSync,
    stopMusic,
    stopSubtitleSync,
    updateMusic,
  };
}
