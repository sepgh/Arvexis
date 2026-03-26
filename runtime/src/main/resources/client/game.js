'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// Arvexis Runtime — Game Client
// ═══════════════════════════════════════════════════════════════════════════════

const API = '';  // same origin

// ── Playback state ───────────────────────────────────────────────────────────

let currentState   = null;  // last /api/game/state response
let hlsInstance    = null;  // current scene Hls instance
let transHls       = null;  // transition Hls instance
let countdownTimer = null;
let decisionMade   = false;
let preloadedHls   = {};    // url → Hls (preloaded transitions)
let preloadedSceneHls = {}; // url → Hls (preloaded next-scene)
let currentMusicUrl = null; // currently playing music URL
let gamePaused      = false;

// ── App state machine ────────────────────────────────────────────────────────
// Screens: 'menu' | 'game' | 'paused' | 'settings'
let appScreen       = 'menu';
let settingsReturnTo = 'menu'; // where to go back from settings

// ── DOM references ───────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const mainMenu          = $('main-menu');
const gameScreen        = $('game-screen');
const pauseOverlay      = $('pause-overlay');
const settingsOverlay   = $('settings-overlay');

const videoEl           = $('video-el');
const transEl           = $('transition-el');
const freezeCanvas      = $('freeze-canvas');
const decisionOverlay   = $('decision-overlay');
const decisionButtons   = $('decision-buttons');
const countdownEl       = $('countdown');
const countdownNum      = $('countdown-num');
const countdownArc      = $('countdown-arc');
const spinner           = $('spinner');
const spinnerText       = $('spinner-text');
const errorBox          = $('error-box');
const errorMsg          = $('error-msg');
const endScreen         = $('end-screen');
const musicEl           = $('music-el');
const pauseBtn          = $('pause-btn');
const subtitleContainer = $('subtitle-container');
const subtitleText      = $('subtitle-text');

// Settings controls
const settingMusicVol       = $('setting-music-vol');
const settingVideoVol       = $('setting-video-vol');
const settingMusicEnabled   = $('setting-music-enabled');
const settingBtnBg          = $('setting-btn-bg');
const settingBtnText        = $('setting-btn-text');
const settingBtnPos         = $('setting-btn-pos');
const settingResolution     = $('setting-resolution');
const settingSubtitlesEnabled = $('setting-subtitles-enabled');
const settingLocale         = $('setting-locale');
const musicVolDisplay       = $('music-vol-display');
const videoVolDisplay       = $('video-vol-display');
const btnBgDisplay          = $('btn-bg-display');
const btnTextDisplay        = $('btn-text-display');

// ── Settings persistence (localStorage) ──────────────────────────────────────

const SETTINGS_KEY = 'arvexis_settings';

const defaultSettings = {
  musicVolume:   0.7,
  videoVolume:   1.0,
  musicEnabled:  true,
  btnBg:         '#000000',
  btnText:       '#ffffff',
  btnPosition:   'bottom',
  resolution:    'auto',
  subtitlesEnabled: true,
  locale:        '',
};

let settings = { ...defaultSettings };

function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) settings = { ...defaultSettings, ...JSON.parse(saved) };
  } catch { /* ignore */ }
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

function applySettings() {
  // Music
  musicEl.volume = settings.musicEnabled ? settings.musicVolume : 0;
  if (!settings.musicEnabled && !musicEl.paused) musicEl.pause();
  if (settings.musicEnabled && musicEl.src && musicEl.paused && appScreen === 'game') {
    musicEl.play().catch(() => {});
  }

  // Video volume
  videoEl.volume = settings.videoVolume;

  // Decision button CSS custom properties
  document.documentElement.style.setProperty('--arvexis-btn-bg',
    hexToRgba(settings.btnBg, 0.65));
  document.documentElement.style.setProperty('--arvexis-btn-text', settings.btnText);
  document.documentElement.style.setProperty('--arvexis-btn-hover-bg',
    hexToRgba(settings.btnText, 0.15));

  // Button position
  decisionOverlay.setAttribute('data-position', settings.btnPosition);

  // Subtitles visibility
  if (subtitleContainer) {
    subtitleContainer.classList.toggle('hidden', !settings.subtitlesEnabled);
  }

  // Sync settings UI
  settingMusicVol.value     = Math.round(settings.musicVolume * 100);
  settingVideoVol.value     = Math.round(settings.videoVolume * 100);
  settingMusicEnabled.checked = settings.musicEnabled;
  settingBtnBg.value        = settings.btnBg;
  settingBtnText.value      = settings.btnText;
  settingBtnPos.value       = settings.btnPosition;
  settingResolution.value   = settings.resolution;
  if (settingSubtitlesEnabled) settingSubtitlesEnabled.checked = settings.subtitlesEnabled;
  if (settingLocale) settingLocale.value = settings.locale;
  musicVolDisplay.textContent = Math.round(settings.musicVolume * 100) + '%';
  videoVolDisplay.textContent = Math.round(settings.videoVolume * 100) + '%';
  btnBgDisplay.textContent  = settings.btnBg;
  btnTextDisplay.textContent = settings.btnText;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Settings UI event listeners ──────────────────────────────────────────────

settingMusicVol.addEventListener('input', () => {
  settings.musicVolume = settingMusicVol.value / 100;
  musicVolDisplay.textContent = settingMusicVol.value + '%';
  musicEl.volume = settings.musicEnabled ? settings.musicVolume : 0;
});

settingVideoVol.addEventListener('input', () => {
  settings.videoVolume = settingVideoVol.value / 100;
  videoVolDisplay.textContent = settingVideoVol.value + '%';
  videoEl.volume = settings.videoVolume;
});

settingMusicEnabled.addEventListener('change', () => {
  settings.musicEnabled = settingMusicEnabled.checked;
  applySettings();
});

settingBtnBg.addEventListener('input', () => {
  settings.btnBg = settingBtnBg.value;
  btnBgDisplay.textContent = settings.btnBg;
  applySettings();
});

settingBtnText.addEventListener('input', () => {
  settings.btnText = settingBtnText.value;
  btnTextDisplay.textContent = settings.btnText;
  applySettings();
});

settingBtnPos.addEventListener('change', () => {
  settings.btnPosition = settingBtnPos.value;
  applySettings();
});

settingResolution.addEventListener('change', () => {
  settings.resolution = settingResolution.value;
});

if (settingSubtitlesEnabled) {
  settingSubtitlesEnabled.addEventListener('change', () => {
    settings.subtitlesEnabled = settingSubtitlesEnabled.checked;
    applySettings();
  });
}

if (settingLocale) {
  settingLocale.addEventListener('change', () => {
    settings.locale = settingLocale.value;
  });
}

// ── Screen management ────────────────────────────────────────────────────────

function showScreen(screen) {
  appScreen = screen;

  mainMenu.classList.toggle('hidden', screen !== 'menu');
  gameScreen.classList.toggle('hidden', screen !== 'game' && screen !== 'paused');
  pauseOverlay.classList.toggle('visible', screen === 'paused');
  settingsOverlay.classList.toggle('visible', screen === 'settings');

  // Hide resolution setting during gameplay (fixed once game starts)
  const resGroup = $('resolution-group');
  if (resGroup) resGroup.style.display = (screen === 'settings' && settingsReturnTo === 'menu') ? '' : 'none';
}

// ── Menu button handlers ─────────────────────────────────────────────────────

$('btn-continue').addEventListener('click', async () => {
  showScreen('game');
  showSpinner('Loading…');
  try {
    const state = await apiFetch('/api/game/state' + localeQueryString());
    await loadScene(state);
  } catch (e) {
    showError('Failed to load: ' + (e.message || e));
  }
});

$('btn-new-game').addEventListener('click', async () => {
  showScreen('game');
  await restartGame();
});

$('btn-menu-settings').addEventListener('click', () => {
  settingsReturnTo = 'menu';
  showScreen('settings');
});

// ── Pause / Resume ───────────────────────────────────────────────────────────

pauseBtn.addEventListener('click', () => pauseGame());

$('btn-resume').addEventListener('click', () => resumeGame());

$('btn-pause-settings').addEventListener('click', () => {
  settingsReturnTo = 'paused';
  showScreen('settings');
});

$('btn-quit-menu').addEventListener('click', () => {
  resumeGame();     // unpause video/music first
  pauseVideo();     // then pause the video for real
  showScreen('menu');
  checkContinue();  // refresh Continue button state
});

$('btn-settings-close').addEventListener('click', () => {
  saveSettings();
  applySettings();
  showScreen(settingsReturnTo);
});

// End screen buttons
$('end-restart').addEventListener('click', async () => {
  endScreen.classList.remove('visible');
  await restartGame();
});

$('end-menu').addEventListener('click', () => {
  endScreen.classList.remove('visible');
  stopMusic();
  showScreen('menu');
  checkContinue();
});

$('error-retry').addEventListener('click', () => location.reload());

// Keyboard: Escape to pause/resume
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (appScreen === 'game') pauseGame();
    else if (appScreen === 'paused') resumeGame();
    else if (appScreen === 'settings') {
      saveSettings();
      applySettings();
      showScreen(settingsReturnTo);
    }
  }
});

function pauseGame() {
  gamePaused = true;
  videoEl.pause();
  musicEl.pause();
  clearCountdown();
  stopSubtitleSync();
  showScreen('paused');
}

function resumeGame() {
  gamePaused = false;
  showScreen('game');
  videoEl.play().catch(() => {});
  if (settings.musicEnabled && musicEl.src) musicEl.play().catch(() => {});
  startSubtitleSync();
}

function pauseVideo() {
  videoEl.pause();
}

// ── Background Music ─────────────────────────────────────────────────────────

function updateMusic(musicUrl) {
  // null/undefined = keep current music playing; explicit new URL = switch
  if (musicUrl === undefined || musicUrl === null) return;

  if (musicUrl === currentMusicUrl) return; // same track, no change

  currentMusicUrl = musicUrl;

  if (!musicUrl) {
    // No music for this scene: stop
    stopMusic();
    return;
  }

  musicEl.src = musicUrl;
  musicEl.volume = settings.musicEnabled ? settings.musicVolume : 0;
  if (settings.musicEnabled) {
    musicEl.play().catch(() => {});
  }
}

function stopMusic() {
  musicEl.pause();
  musicEl.removeAttribute('src');
  musicEl.load();
  currentMusicUrl = null;
}

// ── Subtitle engine ─────────────────────────────────────────────────────────

let currentSubtitles = [];  // [{startTime, endTime, text}] for current scene
let subtitleRafId    = null;

function setSubtitles(subs) {
  currentSubtitles = (subs || []).slice().sort((a, b) => a.startTime - b.startTime);
  if (subtitleText) subtitleText.textContent = '';
}

function startSubtitleSync() {
  stopSubtitleSync();
  if (!currentSubtitles.length || !settings.subtitlesEnabled) return;

  function tick() {
    const t = videoEl.currentTime;
    let found = '';
    for (const s of currentSubtitles) {
      if (t >= s.startTime && t < s.endTime) { found = s.text; break; }
    }
    if (subtitleText) subtitleText.textContent = found;
    subtitleRafId = requestAnimationFrame(tick);
  }
  subtitleRafId = requestAnimationFrame(tick);
}

function stopSubtitleSync() {
  if (subtitleRafId) { cancelAnimationFrame(subtitleRafId); subtitleRafId = null; }
  if (subtitleText) subtitleText.textContent = '';
}

// ── Locale helpers ──────────────────────────────────────────────────────────

function localeQueryString() {
  return settings.locale ? '?locale=' + encodeURIComponent(settings.locale) : '';
}

async function loadLocales() {
  try {
    const data = await apiFetch('/api/game/locales');
    const select = settingLocale;
    if (!select) return;
    // Preserve first "None" option, clear the rest
    while (select.options.length > 1) select.remove(1);
    (data.locales || []).forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = l.name + ' (' + l.code + ')';
      select.appendChild(opt);
    });
    // Auto-select default locale if user hasn't chosen one
    if (!settings.locale && data.defaultLocaleCode) {
      settings.locale = data.defaultLocaleCode;
    }
    select.value = settings.locale;
  } catch { /* no locales available */ }
}

// ── Boot ───────────────────────────────────────────────────────────────────────

(async function boot() {
  loadSettings();
  applySettings();
  showScreen('menu');
  await Promise.all([checkContinue(), loadLocales()]);
})();

async function checkContinue() {
  try {
    const { hasSave } = await apiFetch('/api/game/has-save');
    $('btn-continue').disabled = !hasSave;
  } catch {
    $('btn-continue').disabled = true;
  }
}

// ── Scene loading ─────────────────────────────────────────────────────────────

async function loadScene(state) {
  currentState = state;
  decisionMade = false;

  hideDecisions();
  hideCountdown();
  stopSubtitleSync();
  endScreen.classList.remove('visible');

  showSpinner('Loading scene…');

  // Destroy previous HLS
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }

  await loadHls(videoEl, state.sceneHlsUrl, (hls) => { hlsInstance = hls; });

  // Apply video volume from settings
  videoEl.volume = settings.videoVolume;

  // Start preloading transition HLS segments in background
  preloadTransitions(state.preloadUrls || []);

  // Preload next scene HLS if an auto-continue decision is set
  if (state.autoContinueNextSceneUrl) {
    preloadScene(state.autoContinueNextSceneUrl);
  }

  // Update background music
  updateMusic(state.musicUrl);

  // Load subtitles for this scene
  setSubtitles(state.subtitles || []);

  hideSpinner();

  videoEl.play().catch(() => {});

  // Start subtitle sync loop
  startSubtitleSync();

  const decisions  = state.decisions || [];
  const timeout    = state.decisionTimeoutSecs || 5;
  const isEnd      = state.isEnd;

  // Scene-level auto-continue: no explicit decisions, flag set → play immediately on end
  if (state.autoContinue && decisions.length === 0) {
    videoEl.addEventListener('ended', async () => {
      captureFreeze();
      if (!decisionMade) {
        decisionMade = true;
        await makeDecision('CONTINUE');
      }
    }, { once: true });
    return;
  }

  // ── Decision appearance timing ───────────────────────────────────────────
  let appearAt = null; // null = after video ends
  try {
    if (state.decisionAppearanceConfig) {
      const cfg = JSON.parse(state.decisionAppearanceConfig);
      if (cfg.timing === 'at_timestamp' && typeof cfg.timestamp === 'number') {
        appearAt = cfg.timestamp;
      }
    }
  } catch {}

  if (decisions.length > 0) {
    if (appearAt !== null) {
      videoEl.addEventListener('timeupdate', function onTimeUpdate() {
        if (videoEl.currentTime >= appearAt) {
          videoEl.removeEventListener('timeupdate', onTimeUpdate);
          if (!decisionMade) showDecisions(decisions, timeout);
        }
      });
    }
    videoEl.addEventListener('ended', function onEnded() {
      videoEl.removeEventListener('ended', onEnded);
      captureFreeze();
      if (isEnd) { showEndScreen(); return; }
      if (!decisionMade) showDecisions(decisions, timeout);
    }, { once: true });
  } else if (isEnd) {
    videoEl.addEventListener('ended', () => { captureFreeze(); showEndScreen(); }, { once: true });
  } else {
    videoEl.addEventListener('ended', async () => {
      captureFreeze();
      await makeDecision('CONTINUE');
    }, { once: true });
  }
}

// ── HLS loading helper ────────────────────────────────────────────────────────

function loadHls(videoElement, src, onReady) {
  return new Promise((resolve, reject) => {
    function attachNative() {
      videoElement.src = src;
      videoElement.addEventListener('canplay', () => { onReady && onReady(null); resolve(); }, { once: true });
      videoElement.addEventListener('error', (e) => reject(new Error('Video error: ' + e.message)), { once: true });
    }

    if (typeof Hls === 'undefined' || !Hls.isSupported()) {
      attachNative();
    } else {
      const hls = new Hls({ enableWorker: false, lowLatencyMode: false });
      hls.loadSource(src);
      hls.attachMedia(videoElement);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { onReady && onReady(hls); resolve(); });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          hls.destroy();
          reject(new Error('HLS fatal error: ' + data.type));
        }
      });
      onReady && onReady(hls);
    }
  });
}

// ── Preloading ────────────────────────────────────────────────────────────────

function preloadTransitions(urls) {
  for (const key of Object.keys(preloadedHls)) {
    if (!urls.includes(key)) {
      preloadedHls[key]?.destroy?.();
      delete preloadedHls[key];
    }
  }

  for (const url of urls) {
    if (preloadedHls[url]) continue;
    if (typeof Hls === 'undefined' || !Hls.isSupported()) continue;

    const hls = new Hls({ enableWorker: false });
    const dummy = document.createElement('video');
    dummy.muted = true;
    hls.loadSource(url);
    hls.attachMedia(dummy);
    preloadedHls[url] = hls;
  }
}

function preloadScene(url) {
  if (preloadedSceneHls[url]) return;
  if (typeof Hls === 'undefined' || !Hls.isSupported()) return;

  const hls = new Hls({ enableWorker: false });
  const dummy = document.createElement('video');
  dummy.muted = true;
  hls.loadSource(url);
  hls.attachMedia(dummy);
  preloadedSceneHls[url] = hls;
}

// ── Decisions ─────────────────────────────────────────────────────────────────

function showDecisions(decisions, timeoutSecs) {
  decisionButtons.innerHTML = '';

  const defaultDecision = decisions.find(d => d.isDefault) || decisions[0];

  // Decision translations from the current state response
  const dtMap = (currentState && currentState.decisionTranslations) || {};

  for (const d of decisions) {
    const btn = document.createElement('button');
    btn.className = 'decision-btn' + (d.isDefault ? ' default' : '');
    btn.textContent = dtMap[d.key] || d.key;
    btn.addEventListener('click', () => {
      if (decisionMade) return;
      decisionMade = true;
      clearCountdown();
      hideDecisions();
      makeDecision(d.key);
    });
    decisionButtons.appendChild(btn);
  }

  decisionOverlay.classList.add('visible');
  startCountdown(timeoutSecs, () => {
    if (!decisionMade) {
      decisionMade = true;
      hideDecisions();
      makeDecision(defaultDecision.key);
    }
  });
}

function hideDecisions() {
  decisionOverlay.classList.remove('visible');
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function startCountdown(secs, onExpire) {
  clearCountdown();
  const end = Date.now() + secs * 1000;
  countdownEl.classList.add('visible');

  function tick() {
    const remaining = Math.max(0, (end - Date.now()) / 1000);
    countdownNum.textContent = remaining.toFixed(1) + 's';
    drawArc(remaining / secs);
    if (remaining <= 0) { clearCountdown(); onExpire(); return; }
    countdownTimer = requestAnimationFrame(tick);
  }
  countdownTimer = requestAnimationFrame(tick);
}

function clearCountdown() {
  if (countdownTimer) { cancelAnimationFrame(countdownTimer); countdownTimer = null; }
  countdownEl.classList.remove('visible');
}

function hideCountdown() { clearCountdown(); }

function drawArc(fraction) {
  const ctx = countdownArc.getContext('2d');
  const r = 7, cx = 9, cy = 9;
  ctx.clearRect(0, 0, 18, 18);
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, 2 * Math.PI * fraction - Math.PI / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ── Freeze frame ──────────────────────────────────────────────────────────────

function captureFreeze() {
  try {
    freezeCanvas.width  = videoEl.videoWidth  || 1280;
    freezeCanvas.height = videoEl.videoHeight || 720;
    const ctx = freezeCanvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, freezeCanvas.width, freezeCanvas.height);
    freezeCanvas.style.display = 'block';
  } catch { /* cross-origin or no frame */ }
}

function hideFreeze() {
  freezeCanvas.style.display = 'none';
}

// ── Decision handling ─────────────────────────────────────────────────────────

async function makeDecision(decisionKey) {
  showSpinner('Deciding…');
  stopSubtitleSync();
  try {
    const result = await apiFetch('/api/game/decide' + localeQueryString(), { method: 'POST',
      body: JSON.stringify({ decisionKey }) });

    if (result.transition) {
      await playTransition(result.transition);
    }

    hideFreeze();
    await loadScene(result.nextState);

  } catch (e) {
    showError('Error: ' + (e.message || e));
  }
}

// ── Transition playback ───────────────────────────────────────────────────────

async function playTransition(trans) {
  showSpinner('Transition…');

  if (transHls) { transHls.destroy(); transHls = null; }

  const url = trans.transitionHlsUrl;

  if (preloadedHls[url]) {
    transHls = preloadedHls[url];
    delete preloadedHls[url];
    transHls.attachMedia(transEl);
  }

  await loadHls(transEl, url, (hls) => { transHls = hls; });

  transEl.classList.add('active');
  transEl.play().catch(() => {});

  return new Promise(resolve => {
    transEl.addEventListener('ended', () => {
      transEl.classList.remove('active');
      transEl.src = '';
      if (transHls) { transHls.destroy(); transHls = null; }
      resolve();
    }, { once: true });

    setTimeout(() => {
      transEl.classList.remove('active');
      resolve();
    }, ((trans.duration || 2) + 1) * 1000);
  });
}

// ── Restart ───────────────────────────────────────────────────────────────────

async function restartGame() {
  clearCountdown();
  hideDecisions();
  hideFreeze();
  endScreen.classList.remove('visible');
  showSpinner('Restarting…');

  // Destroy HLS instances
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  if (transHls)    { transHls.destroy();    transHls    = null; }
  for (const h of Object.values(preloadedHls)) h?.destroy?.();
  preloadedHls = {};
  for (const h of Object.values(preloadedSceneHls)) h?.destroy?.();
  preloadedSceneHls = {};

  // Stop music so it restarts from the first scene
  stopMusic();

  try {
    const state = await apiFetch('/api/game/restart' + localeQueryString(), { method: 'POST', body: '{}' });
    await loadScene(state);
  } catch (e) {
    showError('Restart failed: ' + (e.message || e));
  }
}

// ── End screen ────────────────────────────────────────────────────────────────

function showEndScreen() {
  hideSpinner();
  endScreen.classList.add('visible');
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showSpinner(text) {
  spinnerText.textContent = text || 'Loading…';
  spinner.classList.remove('hidden');
  errorBox.classList.remove('visible');
}

function hideSpinner() {
  spinner.classList.add('hidden');
}

function showError(msg) {
  hideSpinner();
  errorMsg.textContent = msg;
  errorBox.classList.add('visible');
}

// ── API fetch wrapper ─────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const resp = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}
