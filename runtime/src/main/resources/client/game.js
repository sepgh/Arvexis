'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

const API = '';  // same origin

let currentState   = null;  // last /api/game/state response
let hlsInstance    = null;  // current scene Hls instance
let transHls       = null;  // transition Hls instance
let countdownTimer = null;
let decisionMade   = false;
let preloadedHls   = {};    // edgeId → Hls (preloaded, buffered)

// ── DOM ────────────────────────────────────────────────────────────────────────

const videoEl       = document.getElementById('videoEl');
const transEl       = document.getElementById('transitionEl');
const freezeCanvas  = document.getElementById('freezeCanvas');
const decisionOverlay = document.getElementById('decisionOverlay');
const decisionButtons = document.getElementById('decisionButtons');
const countdownEl   = document.getElementById('countdown');
const countdownNum  = document.getElementById('countdownNum');
const countdownArc  = document.getElementById('countdownArc');
const sceneTitle    = document.getElementById('sceneTitle');
const spinner       = document.getElementById('spinner');
const spinnerText   = document.getElementById('spinnerText');
const errorBox      = document.getElementById('errorBox');
const errorMsg      = document.getElementById('errorMsg');
const endScreen     = document.getElementById('endScreen');

document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('endRestart').addEventListener('click', restartGame);
document.getElementById('errorRetry').addEventListener('click', () => location.reload());

// ── Boot ───────────────────────────────────────────────────────────────────────

(async function boot() {
  showSpinner('Loading…');
  try {
    const state = await apiFetch('/api/game/state');
    await loadScene(state);
  } catch (e) {
    showError('Failed to start: ' + (e.message || e));
  }
})();

// ── Scene loading ─────────────────────────────────────────────────────────────

async function loadScene(state) {
  currentState = state;
  decisionMade = false;

  sceneTitle.textContent  = state.currentSceneName || '';
  hideDecisions();
  hideCountdown();
  endScreen.classList.remove('visible');

  showSpinner('Loading scene…');

  // Destroy previous HLS
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }

  await loadHls(videoEl, state.sceneHlsUrl, (hls) => { hlsInstance = hls; });

  // Start preloading transition HLS segments in background
  preloadTransitions(state.preloadUrls || []);

  hideSpinner();

  videoEl.play().catch(() => {});

  const duration   = state.duration || 0;
  const decisions  = state.decisions || [];
  const timeout    = state.decisionTimeoutSecs || 5;
  const isEnd      = state.isEnd;

  // ── Decision appearance timing ───────────────────────────────────────────
  // decisionAppearanceConfig is a raw JSON string (or null) with shape:
  // { "timing": "at_timestamp" | "after_video_ends", "timestamp": 4.5 }
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
      // Show decisions at a fixed timestamp
      videoEl.addEventListener('timeupdate', function onTimeUpdate() {
        if (videoEl.currentTime >= appearAt) {
          videoEl.removeEventListener('timeupdate', onTimeUpdate);
          if (!decisionMade) showDecisions(decisions, timeout);
        }
      });
    }
    // Always show on video end (covers after_video_ends + fallback)
    videoEl.addEventListener('ended', function onEnded() {
      videoEl.removeEventListener('ended', onEnded);
      captureFreeze();
      if (isEnd) { showEndScreen(); return; }
      if (!decisionMade) showDecisions(decisions, timeout);
    }, { once: true });
  } else if (isEnd) {
    videoEl.addEventListener('ended', () => { captureFreeze(); showEndScreen(); }, { once: true });
  } else {
    // No decisions and not end → auto-continue when video ends
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
      // Safari native HLS
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
  // Destroy stale preloads not in new list
  for (const key of Object.keys(preloadedHls)) {
    if (!urls.includes(key)) {
      preloadedHls[key]?.destroy?.();
      delete preloadedHls[key];
    }
  }

  for (const url of urls) {
    if (preloadedHls[url]) continue; // already preloading
    if (typeof Hls === 'undefined' || !Hls.isSupported()) continue;

    const hls = new Hls({ enableWorker: false });
    const dummy = document.createElement('video');
    dummy.muted = true;
    hls.loadSource(url);
    hls.attachMedia(dummy);
    preloadedHls[url] = hls;
  }
}

// ── Decisions ─────────────────────────────────────────────────────────────────

function showDecisions(decisions, timeoutSecs) {
  decisionButtons.innerHTML = '';

  const defaultDecision = decisions.find(d => d.isDefault) || decisions[0];

  for (const d of decisions) {
    const btn = document.createElement('button');
    btn.className = 'decision-btn' + (d.isDefault ? ' default' : '');
    btn.textContent = d.key; // label is the key in v1 (localization in T-025)
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
  try {
    const result = await apiFetch('/api/game/decide', { method: 'POST',
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

  // Use preloaded Hls if available
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

    // Safety timeout: if video never ends, resolve after duration + 1s
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

  try {
    const state = await apiFetch('/api/game/restart', { method: 'POST', body: '{}' });
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
