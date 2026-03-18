# Arvexis

We are building **Arvexis** — a Node-Based Interactive Video Engine to build artistic games and interactive video experiences. Below is the description of the system and its parts in detail, as well as design decisions and constraints.


# Tech Stack

- **Editor Backend**: Java (Spring Boot), REST/WebSocket API
- **Editor Frontend**: React + React Flow (web app served by the backend)
- **Video Processing**: FFmpeg (CLI-based), behind an abstraction layer so the underlying tool can be swapped in the future without major refactoring
- **Expression Language**: Spring Expression Language (SpEL) — used for state assignments and decision conditions. Already in the Spring Boot dependency tree, supports math, logic, comparisons, string operations, and parentheses. Can be sandboxed via `SimpleEvaluationContext`. Syntax is simple enough to build highlighting for in the editor frontend.
- **Project Database**: SQLite (embedded, managed by the Java backend)
- **Compiled Runtime Server**: Java (lightweight embedded server)
- **Compiled Runtime Client**: Web browser-based (HTML/JS served by the Java server)


# Graph Definition

The project is modeled as a **directed graph** with the following rules:

- There is always exactly **one root node** (entry point). The root node is flagged, and the user can change which node is root (useful for testing different parts of the graph).
- **Cycles are allowed**. Loops can be used to increment state counters or revisit scenes, affecting the game experience.
- A game/experience ends when a scene node with an **`end` flag** is reached.
- **Unreachable nodes** are allowed (e.g., work-in-progress). The editor should display a **warning** for unreachable nodes, but they are not errors. Unreachable nodes are **excluded from final compilation**.
- Every node has a **name** (user-defined, for identification and search in the editor).
- Every node has a **position** (x, y coordinates on the editor canvas). Node positions are persisted as part of the project data so the graph layout is preserved across sessions. When a node is dragged in the editor, its position is saved.


## Asset Management

Assets (video, audio files) are managed separately in the project, stored in a configurable directory. The engine user can organize assets in subdirectories and assign **tags** (flat list of reusable string tags shared across files).

Assets can be referenced in scenes or transitions by directory/file name or discovered through tags.

### Asset Upload & Folder Management

The editor supports uploading media files directly through the UI:
- `POST /api/assets/upload` — multipart upload; optionally specify a `folder` destination
- `POST /api/assets/folder` — create a new subfolder within the assets directory
- `GET /api/assets/folders` — list all existing subdirectories

Safety constraints: paths are resolved relative to the configured assets directory; path traversal (`..`) is rejected.

### Supported Formats

Any widely-used video and audio formats are supported (e.g., ProRes 444, H.264, H.265, VP9 for video; WAV, MP3, AAC, FLAC for audio).

When a video asset is added to the project, the engine must **detect whether it has alpha channels**. This information is stored in the asset index.

**Constraints on video layers in scenes:**
- When multiple video layers are used in a scene, all layers **except the bottom-most** must have alpha channels. If a video without alpha is added as a non-bottom layer, the editor must show an error.
- Videos with different codecs/formats in the same scene may not be directly compositable. The engine must validate format compatibility during scene editing and show clear errors if incompatible formats are combined. FFmpeg handles most cross-format compositing, but edge cases (e.g., mixed frame rates, mixed resolutions) should be detected and reported.


## Scene Node

A scene node contains:

- A **name** (user-defined identifier)
- An ordered list of **video layers**, each with:
  - Video file reference (from assets)
  - `start-at`: timestamp (in seconds) into the scene timeline where this layer begins playing. Used by the compiler; the client plays the pre-compiled result.
- An ordered list of **audio tracks**, each with:
  - Audio file reference (from assets)
  - `start-at`: timestamp (in seconds) into the scene timeline where this audio begins playing.
- A **background color**: the base layer color behind all video layers, filling any remaining alpha-transparent areas.
- An **`end` flag**: if set, reaching this scene ends the game/experience.
- A **default decision**: which decision is auto-selected if the player doesn't choose in time.
- **Decision button appearance configuration** (per scene):
  - **Timing**: buttons can appear **at a specific timestamp** during the scene, or **after the video ends**. Both options are available.
  - **Position**: handled by the compiled client (not baked into the video). The client provides layout options for button placement.
  - **Style**: v1 uses a default style. Custom styling is deferred to a future version.

**Scene duration** is determined by the longest layer (video or audio): `max(layer_duration + start_at)` across all video layers and audio tracks.

A compiled scene uses FFmpeg to composite all video layers and mix audio tracks into a single output file.


### Scene Node Decisions

Each scene node can have a list of **decisions**. Each decision has a key.

- If **no decisions** are defined, a default `CONTINUE` decision exists automatically, creating a single outgoing edge.
- If **one or more decisions** are explicitly defined, there is **no** default `CONTINUE`. All decisions must be explicitly listed.
- Each decision key creates a possible edge/path to other nodes in the graph.
- One decision must be marked as the **default** — it is auto-selected if the player doesn't choose within the timeout.
- **Decision timeout**: configurable at the project level (default: 5 seconds). After the timeout, the default decision is selected automatically.


## State Node

A state node contains a set of **assignments** that mutate global state. State keys are global and accessible from any node.

Expressions are written in **Spring SpEL** syntax. Examples:
- `#VISIT_COUNT = #VISIT_COUNT + 1`
- `#VISIT_COUNT = 100`
- `#HAS_KEY = true`
- `#LABEL = 'hello' + ' world'`

SpEL supports all needed operations: math (`+`, `-`, `*`, `/`, `%`), logic (`and`, `or`, `not`/`!`), comparisons (`==`, `!=`, `<`, `>`, `<=`, `>=`), string concatenation (`+`), and parentheses for grouping.

**State key types**: numeric, string, boolean (standard primitive types).

**Default values**: all state keys are initialized to `0` / `null` by default unless explicitly set.

A state node has exactly **one outgoing edge** (it processes mutations and immediately continues to the next node).


## Condition Node

A condition node contains an **ordered list of conditions**. Each condition is a **SpEL expression** that evaluates to a boolean.

Examples:
- `#VISIT_COUNT > 3`
- `#HAS_KEY == true and #SCORE >= 50`
- `(#A > 5 and #B != 3) or #C == true`

There is always an **`else`** condition as the last item in the list (fallback).

Each condition has:
- A **name** (user-defined, shown as the exit handle label on the canvas node)
- A **SpEL boolean expression** (null for the else branch)
- An outgoing edge identified by the condition name (`source_condition_name`)

When a condition is met, the graph follows that edge immediately (first match wins).


## Transitions

Transitions are defined on **edges**, with the constraint that **only edges whose endpoint is a scene node** can have transition effects.

### Built-in Effects (v1)
- Fade-in / Fade-out
- Crossfade
- Slide-left / Slide-right
- Wipe
- Dissolve
- Cut (instant, no effect)

### Video-based Transitions
Alternatively, a transition can be a video, structured like a scene: ordered video layers with alpha + audio tracks with `start-at`.

### Constraints
- **Maximum duration**: 5 seconds (hard limit enforced by the engine).
- **No transition**: it is valid for an edge to have no transition at all (instant jump).


## Localization (Subtitles & Decision Translations)

The localization system supports:

- **Subtitles**: per-scene, per-locale subtitle tracks. Each subtitle entry has a start time, end time, and text.
- **Decision label translations**: each decision key can have translated display labels per locale.
- **Project default locale**: the project has a default locale.
- **Locale management**: locales are defined at the project level. Adding a locale makes it available for all scenes and decisions.

Data model:

```
Locale:
  - code (e.g., "en", "fa", "de")
  - name (e.g., "English", "فارسی", "Deutsch")

SubtitleEntry:
  - scene_id
  - locale_code
  - start_time (seconds)
  - end_time (seconds)
  - text

DecisionTranslation:
  - decision_key
  - scene_id
  - locale_code
  - label (display text)
```


## Project Configuration

- Project name
- Project location (root directory)
- Assets location (directory)
- Compile resolutions: 2K, 1080p, 720p
- Preview resolution
- FPS: 24, 30
- Audio sample rate
- Audio bit rate
- Output directory
- **Decision timeout** (seconds, default: 5) — how long the player has to choose before the default decision is auto-selected
- Default locale


## Project Database

**SQLite** (embedded) is used to persist:

- The full graph structure (nodes, edges, transitions)
- Project configuration
- Asset index (paths, tags, metadata including alpha channel detection)
- Localization data

**Auto-save** is supported. The editor auto-saves project state.

**Undo/Redo**: deferred to a future version, but the architecture should not make it harder to implement later. Design choices (e.g., command pattern for mutations) should keep this path open.


# Editor Lifecycle

- The editor is a **single-project** application (one project open at a time).
- **New project**: the editor provides a wizard to create a new project (select directory, set initial configuration).
- **Open project**: the user can open an existing project directory.


# Preview Compilation

Each scene node or video-based transition has a **preview** action. When triggered:

1. The engine compiles the scene/transition using FFmpeg at the **preview resolution** defined in project configuration.
2. The result plays in a modal window in the editor.


# Final Compilation

The compilation engine is a **separate module**. The compilation process:

1. The editor produces a **JSON manifest** containing all necessary information (graph structure, asset references, configuration, localization data).
2. The compilation engine reads this manifest and produces the compiled output in the configured output directory.
3. **Unreachable nodes are excluded** from the manifest and compilation.

## Compiled Output

The output is a **complete package** that works **offline by default**:

- A Java-based server (executable JAR or similar)
- A web-based client (HTML/JS/CSS)
- All compiled video/audio assets
- Documentation/instructions for hosting it online

The package works on both **Linux and Windows**.

### v1 Constraints
- Single user/session (no concurrent players).
- **Game state persists across browser refreshes** — the server saves the player's current position in the graph and all state key values. The player can resume where they left off.
- A **restart game** option is available to reset state and return to the root node.
- Future versions will support multiple sessions with save/checkpoint per session.

## Video Playback (Server Side)

Compiled scenes and transitions are converted to **HLS** (HTTP Live Streaming) format:

- `.m3u8` playlists + `.ts` segment files
- Multiple resolutions (as configured)
- Segment sizes are configurable but default to automatic calculation based on FPS and scene duration
- HLS is CDN-friendly and natively supported by browsers

**Goals:**
1. CDN-cacheable video segments
2. Seamless client-side playback

The server manages:
- Serving video segments
- Returning available decisions/choices to the client
- Managing game state and save/checkpoint

### Preloading Strategy

When a scene is playing, the server provides the client with preload hints for **all transitions on edges leaving the current scene node**. This ensures:
- Transitions from direct edges are preloaded (smooth playback)
- Transitions behind decision/state nodes don't need preloading (they go through non-scene nodes first)
- If an unlikely/unpreloaded transition needs to play, it must still work correctly (just without the preload optimization)

## Client Side

The compiled client (web-based, served by the Java server) handles:

- Video playback (HLS via browser-native or hls.js)
- When a scene ends and decisions are pending, the **last video frame stays visible** (freeze frame) while the player chooses
- Displaying decision buttons (position managed by the client)
- Sending decision selections to the server
- Receiving and applying preload hints for upcoming transitions
- Restart game option


