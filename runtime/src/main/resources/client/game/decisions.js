export function createDecisionController(ctx, ui, playback) {
  function normalizeDecisionHotkey(key) {
    if (!key || key === 'Unidentified') return null;
    if (key === ' ' || key === 'Spacebar') return 'space';
    return String(key).toLowerCase();
  }

  function formatDecisionHotkey(key) {
    if (!key) return '';
    if (key === ' ') return 'Space';
    return key;
  }

  function setActiveDecisionHotkeys(decisions) {
    ctx.state.activeDecisionHotkeys = new Map();
    for (const decision of decisions || []) {
      const normalized = normalizeDecisionHotkey(decision.keyboardKey);
      if (normalized) ctx.state.activeDecisionHotkeys.set(normalized, decision);
    }
  }

  function clearActiveDecisionHotkeys() {
    ctx.state.activeDecisionHotkeys = new Map();
  }

  function findDecisionByKey(key) {
    return ctx.state.activeDecisionHotkeys.get(normalizeDecisionHotkey(key));
  }

  function showDecisionInputIndicator(decisions) {
    if (!ctx.dom.decisionInputIndicator) return;
    const shouldShow = !!(
      ctx.state.currentState &&
      ctx.state.currentState.hideDecisionButtons &&
      ctx.state.currentState.showDecisionInputIndicator
    );
    const hotkeys = (decisions || [])
      .map((decision) => formatDecisionHotkey(decision.keyboardKey))
      .filter(Boolean);
    const text = shouldShow && hotkeys.length > 0
      ? `Input ready — press ${hotkeys.join(' / ')}`
      : '';
    ctx.dom.decisionInputIndicator.textContent = text;
    ctx.dom.decisionInputIndicator.classList.toggle('visible', text !== '');
  }

  function hideDecisionInputIndicator() {
    if (!ctx.dom.decisionInputIndicator) return;
    ctx.dom.decisionInputIndicator.textContent = '';
    ctx.dom.decisionInputIndicator.classList.remove('visible');
  }

  function startCountdown(seconds, onExpire) {
    clearCountdown();
    const end = Date.now() + seconds * 1000;
    ctx.dom.countdownEl.classList.add('visible');

    function tick() {
      const remaining = Math.max(0, (end - Date.now()) / 1000);
      ctx.dom.countdownNum.textContent = remaining.toFixed(1) + 's';
      drawArc(remaining / seconds);
      if (remaining <= 0) {
        clearCountdown();
        onExpire();
        return;
      }
      ctx.state.countdownTimer = requestAnimationFrame(tick);
    }

    ctx.state.countdownTimer = requestAnimationFrame(tick);
  }

  function clearCountdown() {
    if (ctx.state.countdownTimer) {
      cancelAnimationFrame(ctx.state.countdownTimer);
      ctx.state.countdownTimer = null;
    }
    ctx.dom.countdownEl.classList.remove('visible');
  }

  function hideCountdown() {
    clearCountdown();
  }

  function drawArc(fraction) {
    const drawContext = ctx.dom.countdownArc.getContext('2d');
    const radius = 7;
    const centerX = 9;
    const centerY = 9;
    drawContext.clearRect(0, 0, 18, 18);
    drawContext.beginPath();
    drawContext.arc(centerX, centerY, radius, -Math.PI / 2, 2 * Math.PI * fraction - Math.PI / 2);
    drawContext.strokeStyle = 'rgba(255,255,255,0.7)';
    drawContext.lineWidth = 2;
    drawContext.stroke();
  }

  function hideDecisions() {
    clearActiveDecisionHotkeys();
    ctx.dom.decisionOverlay.classList.remove('visible');
    ctx.dom.decisionButtons.innerHTML = '';
    hideDecisionInputIndicator();
  }

  function showUnavailableDecisionsError() {
    if (ctx.state.decisionMade) return;
    ctx.state.decisionMade = true;
    clearCountdown();
    hideDecisions();
    ui.captureFreeze();
    ctx.dom.videoEl.pause();
    playback.stopSubtitleSync();
    ui.showError('No decisions are currently available for this scene.');
  }

  function showDecisions(decisions, timeoutSeconds, onDecision) {
    if (!decisions || decisions.length === 0) {
      showUnavailableDecisionsError();
      return;
    }

    ctx.dom.decisionButtons.innerHTML = '';
    setActiveDecisionHotkeys(decisions);

    const defaultDecision = decisions.find((decision) => decision.isDefault) || decisions[0];
    const hideDecisionButtons = !!(ctx.state.currentState && ctx.state.currentState.hideDecisionButtons);
    const translations = (ctx.state.currentState && ctx.state.currentState.decisionTranslations) || {};

    if (!hideDecisionButtons) {
      for (const decision of decisions) {
        const button = document.createElement('button');
        button.className = 'decision-btn' + (decision.isDefault ? ' default' : '');
        const label = translations[decision.key] || decision.key;
        button.textContent = decision.keyboardKey
          ? `${label} [${formatDecisionHotkey(decision.keyboardKey)}]`
          : label;
        button.addEventListener('click', () => {
          if (ctx.state.decisionMade) return;
          ctx.state.decisionMade = true;
          clearCountdown();
          hideDecisions();
          onDecision(decision.key);
        });
        ctx.dom.decisionButtons.appendChild(button);
      }
    }

    ctx.dom.decisionOverlay.classList.toggle('visible', !hideDecisionButtons);
    showDecisionInputIndicator(decisions);
    startCountdown(timeoutSeconds, () => {
      if (!ctx.state.decisionMade) {
        ctx.state.decisionMade = true;
        hideDecisions();
        onDecision(defaultDecision.key);
      }
    });
  }

  return {
    clearActiveDecisionHotkeys,
    clearCountdown,
    findDecisionByKey,
    hideCountdown,
    hideDecisions,
    normalizeDecisionHotkey,
    showDecisions,
    showUnavailableDecisionsError,
  };
}
