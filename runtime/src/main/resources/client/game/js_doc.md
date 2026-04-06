## Responsibilities after the split

- **[api.js](../api.js)**
  - fetch wrapper for runtime APIs

- **[context.js](../context.js)**
  - shared DOM refs, settings defaults, runtime state

- **[ui.js](../ui.js)**
  - screen switching
  - spinner/error/end screen
  - freeze-frame capture
  - scene video listener bookkeeping

- **[settings.js](../settings.js)**
  - localStorage settings
  - locale loading
  - applying UI/audio/button/subtitle settings

- **[playback.js](../playback.js)**
  - HLS loading
  - transition playback
  - preloading
  - music
  - subtitle sync

- **[decisions.js](../decisions.js)**
  - decision hotkeys
  - decision overlay
  - countdown
  - unavailable-decision handling

- **[scene.js](../scene.js)**
  - scene loading
  - scene event flow
  - auto-continue
  - looping behavior
  - decision traversal
  - restart flow

- **[app.js](../app.js)**
  - bootstrapping
  - menu/pause/settings button wiring
  - keyboard input routing

## `Esc` pauses the game

Centralized keyboard handling in [app.js](../app.js) and made `Escape`:

- pause when screen is `game`
- resume when screen is `paused`
- close settings when screen is `settings`

also added:

- `preventDefault()`
- `stopPropagation()`
- `event.repeat` guard

That makes `Escape` behavior more reliable and avoids repeated toggle spam while the key is held.
