const config = window.ARVEXIS_RUNTIME_CONFIG || {};
const state = {
  locale: '',
  sessionId: config.sessionId || null,
  currentState: null,
  subtitles: [],
  subtitleTimer: null,
  hls: null,
};

const els = {
  projectName: document.getElementById('project-name'),
  localeSelect: document.getElementById('locale-select'),
  refreshButton: document.getElementById('refresh-button'),
  restartButton: document.getElementById('restart-button'),
  sceneVideo: document.getElementById('scene-video'),
  subtitleBox: document.getElementById('subtitle-box'),
  status: document.getElementById('status'),
  sceneId: document.getElementById('scene-id'),
  sceneName: document.getElementById('scene-name'),
  sessionId: document.getElementById('session-id'),
  decisions: document.getElementById('decisions'),
  variables: document.getElementById('variables'),
};

function buildUrl(path) {
  const url = new URL((config.apiBasePath || '') + path, window.location.origin);
  if (state.sessionId) {
    url.searchParams.set('sessionId', state.sessionId);
  }
  if (state.locale) {
    url.searchParams.set('locale', state.locale);
  }
  return url;
}

async function apiFetch(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin',
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  syncSessionId(data);
  return data;
}

function syncSessionId(payload) {
  if (!payload || typeof payload !== 'object') {
    return;
  }
  if (payload.sessionId) {
    state.sessionId = payload.sessionId;
    return;
  }
  if (payload.nextState && payload.nextState.sessionId) {
    state.sessionId = payload.nextState.sessionId;
  }
}

function setStatus(message) {
  els.status.textContent = message;
}

function clearHls() {
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }
}

function loadVideo(url) {
  clearHls();
  els.sceneVideo.pause();
  if (window.Hls && window.Hls.isSupported()) {
    const hls = new window.Hls();
    hls.loadSource(url);
    hls.attachMedia(els.sceneVideo);
    state.hls = hls;
    return;
  }
  els.sceneVideo.src = url;
}

function renderSubtitles(subtitles) {
  state.subtitles = Array.isArray(subtitles) ? subtitles.slice() : [];
  if (state.subtitleTimer) {
    cancelAnimationFrame(state.subtitleTimer);
    state.subtitleTimer = null;
  }
  const tick = () => {
    const currentTime = els.sceneVideo.currentTime;
    const current = state.subtitles.find((entry) => currentTime >= entry.startTime && currentTime < entry.endTime);
    els.subtitleBox.textContent = current ? current.text : '';
    state.subtitleTimer = requestAnimationFrame(tick);
  };
  state.subtitleTimer = requestAnimationFrame(tick);
}

function renderDecisions(runtimeState) {
  els.decisions.innerHTML = '';
  const translations = runtimeState.decisionTranslations || {};
  for (const decision of runtimeState.decisions || []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'decision-button';
    const label = translations[decision.key] || decision.key;
    button.textContent = decision.keyboardKey ? `${label} [${decision.keyboardKey}]` : label;
    button.addEventListener('click', async () => {
      try {
        setStatus(`Applying ${decision.key}…`);
        const result = await apiFetch('/api/game/decide', {
          method: 'POST',
          body: JSON.stringify({ decisionKey: decision.key }),
        });
        await renderState(result.nextState);
      } catch (error) {
        setStatus(error.message || String(error));
      }
    });
    els.decisions.appendChild(button);
  }
}

async function renderState(runtimeState) {
  state.currentState = runtimeState;
  syncSessionId(runtimeState);
  els.sceneId.textContent = runtimeState.currentSceneId || '-';
  els.sceneName.textContent = runtimeState.currentSceneName || '-';
  els.sessionId.textContent = state.sessionId || '-';
  els.variables.textContent = JSON.stringify(runtimeState.variables || {}, null, 2);
  renderDecisions(runtimeState);
  renderSubtitles(runtimeState.subtitles || []);
  if (runtimeState.sceneHlsUrl) {
    loadVideo(runtimeState.sceneHlsUrl);
    try {
      await els.sceneVideo.play();
    } catch {
    }
  }
  if (runtimeState.isEnd) {
    setStatus('Reached the end of the game. You can restart or reload.');
  } else if ((runtimeState.decisions || []).length === 0) {
    setStatus('No decisions available for this scene.');
  } else {
    setStatus('Choose the next decision.');
  }
}

async function loadLocales() {
  const data = await apiFetch('/api/game/locales');
  while (els.localeSelect.options.length > 1) {
    els.localeSelect.remove(1);
  }
  for (const locale of data.locales || []) {
    const option = document.createElement('option');
    option.value = locale.code;
    option.textContent = `${locale.name} (${locale.code})`;
    els.localeSelect.appendChild(option);
  }
  if (!state.locale && data.defaultLocaleCode) {
    state.locale = data.defaultLocaleCode;
  }
  els.localeSelect.value = state.locale;
}

async function loadInfo() {
  const data = await apiFetch('/api/game/info');
  els.projectName.textContent = data.projectName || config.gameKey || 'Arvexis';
  document.title = `${els.projectName.textContent} — Embedded Player`;
}

async function loadState() {
  const runtimeState = await apiFetch('/api/game/state');
  await renderState(runtimeState);
}

async function restart() {
  const runtimeState = await apiFetch('/api/game/restart', {
    method: 'POST',
    body: '{}',
  });
  await renderState(runtimeState);
}

async function boot() {
  els.localeSelect.addEventListener('change', async () => {
    state.locale = els.localeSelect.value;
    await loadState();
  });
  els.refreshButton.addEventListener('click', loadState);
  els.restartButton.addEventListener('click', restart);
  els.sceneVideo.addEventListener('ended', async () => {
    if (state.currentState && state.currentState.autoContinue) {
      try {
        const result = await apiFetch('/api/game/decide', {
          method: 'POST',
          body: JSON.stringify({ decisionKey: 'CONTINUE' }),
        });
        await renderState(result.nextState);
      } catch (error) {
        setStatus(error.message || String(error));
      }
    }
  });
  try {
    await loadInfo();
    await loadLocales();
    await loadState();
  } catch (error) {
    setStatus(error.message || String(error));
  }
}

boot();
