const SETTINGS_KEY = 'arvexis_settings';

export function createSettingsController(ctx, { apiFetch, playback }) {
  function loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) ctx.settings = { ...ctx.defaultSettings, ...JSON.parse(saved) };
    } catch {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(ctx.settings));
    } catch {}
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function applySettings() {
    ctx.dom.musicEl.volume = ctx.settings.musicEnabled ? ctx.settings.musicVolume : 0;
    if (!ctx.settings.musicEnabled && !ctx.dom.musicEl.paused) ctx.dom.musicEl.pause();
    if (ctx.settings.musicEnabled && ctx.dom.musicEl.src && ctx.dom.musicEl.paused && ctx.state.appScreen === 'game') {
      ctx.dom.musicEl.play().catch(() => {});
    }
    playback.refreshAmbientVolume();

    ctx.dom.videoEl.volume = ctx.settings.videoVolume;
    ctx.dom.transEl.volume = ctx.settings.videoVolume;

    document.documentElement.style.setProperty('--arvexis-btn-bg', hexToRgba(ctx.settings.btnBg, 0.65));
    document.documentElement.style.setProperty('--arvexis-btn-text', ctx.settings.btnText);
    document.documentElement.style.setProperty('--arvexis-btn-hover-bg', hexToRgba(ctx.settings.btnText, 0.15));

    ctx.dom.decisionOverlay.setAttribute('data-position', ctx.settings.btnPosition);

    if (ctx.dom.subtitleContainer) {
      ctx.dom.subtitleContainer.classList.toggle('hidden', !ctx.settings.subtitlesEnabled);
    }

    ctx.dom.settingMusicVol.value = Math.round(ctx.settings.musicVolume * 100);
    ctx.dom.settingAmbientVol.value = Math.round(ctx.settings.ambientVolume * 100);
    ctx.dom.settingVideoVol.value = Math.round(ctx.settings.videoVolume * 100);
    ctx.dom.settingMusicEnabled.checked = ctx.settings.musicEnabled;
    ctx.dom.settingBtnBg.value = ctx.settings.btnBg;
    ctx.dom.settingBtnText.value = ctx.settings.btnText;
    ctx.dom.settingBtnPos.value = ctx.settings.btnPosition;
    ctx.dom.settingResolution.value = ctx.settings.resolution;
    if (ctx.dom.settingSubtitlesEnabled) ctx.dom.settingSubtitlesEnabled.checked = ctx.settings.subtitlesEnabled;
    if (ctx.dom.settingLocale) ctx.dom.settingLocale.value = ctx.settings.locale;
    ctx.dom.musicVolDisplay.textContent = Math.round(ctx.settings.musicVolume * 100) + '%';
    ctx.dom.ambientVolDisplay.textContent = Math.round(ctx.settings.ambientVolume * 100) + '%';
    ctx.dom.videoVolDisplay.textContent = Math.round(ctx.settings.videoVolume * 100) + '%';
    ctx.dom.btnBgDisplay.textContent = ctx.settings.btnBg;
    ctx.dom.btnTextDisplay.textContent = ctx.settings.btnText;
  }

  function localeQueryString() {
    return ctx.settings.locale ? '?locale=' + encodeURIComponent(ctx.settings.locale) : '';
  }

  async function loadLocales() {
    try {
      const data = await apiFetch('/api/game/locales');
      const select = ctx.dom.settingLocale;
      if (!select) return;
      while (select.options.length > 1) select.remove(1);
      (data.locales || []).forEach((locale) => {
        const opt = document.createElement('option');
        opt.value = locale.code;
        opt.textContent = locale.name + ' (' + locale.code + ')';
        select.appendChild(opt);
      });
      if (!ctx.settings.locale && data.defaultLocaleCode) {
        ctx.settings.locale = data.defaultLocaleCode;
      }
      select.value = ctx.settings.locale;
    } catch {}
  }

  function bindSettingsControls() {
    ctx.dom.settingMusicVol.addEventListener('input', () => {
      ctx.settings.musicVolume = ctx.dom.settingMusicVol.value / 100;
      ctx.dom.musicVolDisplay.textContent = ctx.dom.settingMusicVol.value + '%';
      ctx.dom.musicEl.volume = ctx.settings.musicEnabled ? ctx.settings.musicVolume : 0;
    });

    ctx.dom.settingAmbientVol.addEventListener('input', () => {
      ctx.settings.ambientVolume = ctx.dom.settingAmbientVol.value / 100;
      ctx.dom.ambientVolDisplay.textContent = ctx.dom.settingAmbientVol.value + '%';
      playback.refreshAmbientVolume();
    });

    ctx.dom.settingVideoVol.addEventListener('input', () => {
      ctx.settings.videoVolume = ctx.dom.settingVideoVol.value / 100;
      ctx.dom.videoVolDisplay.textContent = ctx.dom.settingVideoVol.value + '%';
      ctx.dom.videoEl.volume = ctx.settings.videoVolume;
      ctx.dom.transEl.volume = ctx.settings.videoVolume;
    });

    ctx.dom.settingMusicEnabled.addEventListener('change', () => {
      ctx.settings.musicEnabled = ctx.dom.settingMusicEnabled.checked;
      applySettings();
    });

    ctx.dom.settingBtnBg.addEventListener('input', () => {
      ctx.settings.btnBg = ctx.dom.settingBtnBg.value;
      ctx.dom.btnBgDisplay.textContent = ctx.settings.btnBg;
      applySettings();
    });

    ctx.dom.settingBtnText.addEventListener('input', () => {
      ctx.settings.btnText = ctx.dom.settingBtnText.value;
      ctx.dom.btnTextDisplay.textContent = ctx.settings.btnText;
      applySettings();
    });

    ctx.dom.settingBtnPos.addEventListener('change', () => {
      ctx.settings.btnPosition = ctx.dom.settingBtnPos.value;
      applySettings();
    });

    ctx.dom.settingResolution.addEventListener('change', () => {
      ctx.settings.resolution = ctx.dom.settingResolution.value;
    });

    if (ctx.dom.settingSubtitlesEnabled) {
      ctx.dom.settingSubtitlesEnabled.addEventListener('change', () => {
        ctx.settings.subtitlesEnabled = ctx.dom.settingSubtitlesEnabled.checked;
        applySettings();
      });
    }

    if (ctx.dom.settingLocale) {
      ctx.dom.settingLocale.addEventListener('change', () => {
        ctx.settings.locale = ctx.dom.settingLocale.value;
      });
    }
  }

  return {
    applySettings,
    bindSettingsControls,
    loadLocales,
    loadSettings,
    localeQueryString,
    saveSettings,
  };
}
