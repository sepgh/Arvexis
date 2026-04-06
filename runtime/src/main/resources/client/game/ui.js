export function createUiController(ctx) {
  function showScreen(screen) {
    ctx.state.appScreen = screen;

    ctx.dom.mainMenu.classList.toggle('hidden', screen !== 'menu');
    ctx.dom.gameScreen.classList.toggle('hidden', screen !== 'game' && screen !== 'paused');
    ctx.dom.pauseOverlay.classList.toggle('visible', screen === 'paused');
    ctx.dom.settingsOverlay.classList.toggle('visible', screen === 'settings');

    const resGroup = ctx.$('resolution-group');
    if (resGroup) {
      resGroup.style.display = (screen === 'settings' && ctx.state.settingsReturnTo === 'menu') ? '' : 'none';
    }
  }

  function showSpinner(text) {
    ctx.dom.spinnerText.textContent = text || 'Loading…';
    ctx.dom.spinner.classList.remove('hidden');
    ctx.dom.errorBox.classList.remove('visible');
  }

  function hideSpinner() {
    ctx.dom.spinner.classList.add('hidden');
  }

  function showError(msg) {
    hideSpinner();
    ctx.dom.errorMsg.textContent = msg;
    ctx.dom.errorBox.classList.add('visible');
  }

  function showEndScreen() {
    hideSpinner();
    ctx.dom.endScreen.classList.add('visible');
  }

  function captureFreezeFrom(videoElement) {
    try {
      ctx.dom.freezeCanvas.width = videoElement.videoWidth || 1280;
      ctx.dom.freezeCanvas.height = videoElement.videoHeight || 720;
      const freezeContext = ctx.dom.freezeCanvas.getContext('2d');
      freezeContext.drawImage(videoElement, 0, 0, ctx.dom.freezeCanvas.width, ctx.dom.freezeCanvas.height);
      ctx.dom.freezeCanvas.style.display = 'block';
    } catch {}
  }

  function captureFreeze() {
    captureFreezeFrom(ctx.dom.videoEl);
  }

  function hideFreeze() {
    ctx.dom.freezeCanvas.style.display = 'none';
  }

  function addSceneVideoListener(type, handler, options) {
    ctx.dom.videoEl.addEventListener(type, handler, options);
    const capture = typeof options === 'boolean' ? options : !!(options && options.capture);
    ctx.state.sceneVideoListeners.push({ type, handler, capture });
  }

  function clearSceneVideoListeners() {
    for (const listener of ctx.state.sceneVideoListeners) {
      ctx.dom.videoEl.removeEventListener(listener.type, listener.handler, listener.capture);
    }
    ctx.state.sceneVideoListeners = [];
  }

  return {
    addSceneVideoListener,
    captureFreeze,
    captureFreezeFrom,
    clearSceneVideoListeners,
    hideFreeze,
    hideSpinner,
    showEndScreen,
    showError,
    showScreen,
    showSpinner,
  };
}
