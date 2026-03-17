# Tasks

Ordered implementation tasks for the Interactive Video Engine.
Refer to [system-design.md](system-design.md) for full design details.
Also, mockup is created to get ideas for the editor.

**Status legend**: `[ ]` not started · `[~]` in progress · `[x]` done

---

## T-001: Java Backend Project Setup

**Description**: Initialize the Spring Boot project with the required dependencies and base structure.

**Work**:
- Create a Spring Boot application (Maven or Gradle)
- Add dependencies: Spring Web, Spring WebSocket, SQLite JDBC, Spring SpEL (included in core), Flyway (for DB migrations)
- Set up base package structure: `controller`, `service`, `repository`, `model`, `config`, `ffmpeg`
- Create a health-check endpoint (`GET /api/health`)
- Configure application properties (server port, SQLite file path placeholder)

**Testable outcome**:
- `[x]` Application starts without errors
- `[x]` `GET /api/health` returns `200 OK`

---

## T-002: React Frontend Project Setup

**Description**: Initialize the React application with React Flow and essential tooling.

**Work**:
- Create React app (Vite + TypeScript)
- Install dependencies: `reactflow`, `react-router-dom`, `axios` (or fetch wrapper), a UI component library (e.g., shadcn/ui + Tailwind CSS)
- Set up base folder structure: `components`, `pages`, `hooks`, `api`, `types`, `store`
- Create a root layout with a placeholder canvas page
- Configure proxy to Java backend during development

**Testable outcome**:
- `[x]` Frontend builds and loads in browser
- `[x]` Empty React Flow canvas renders on the main page
- `[x]` API proxy to backend works (health check call succeeds)

---

## T-003: SQLite Database Schema & Migrations

**Description**: Define the complete database schema covering all entities from the system design, including localization tables (data model only — no localization UI in v1). Use Flyway for versioned migrations.

**Work**:
- `project_config` — project-level settings (name, paths, resolutions, FPS, audio settings, decision timeout, default locale, output directory)
- `nodes` — id, name, type (scene/state/decision), is_root, is_end, background_color, decision_appearance_config (JSON)
- `node_video_layers` — node_id, asset_id, order, start_at
- `node_audio_tracks` — node_id, asset_id, order, start_at
- `node_state_assignments` — node_id, order, expression (SpEL)
- `node_decision_conditions` — node_id, order, expression (SpEL), is_else
- `scene_decisions` — node_id, decision_key, is_default, order
- `edges` — id, source_node_id, source_decision_key (nullable), source_condition_order (nullable), target_node_id
- `edge_transitions` — edge_id, type (none/fade_in/fade_out/crossfade/slide_left/slide_right/wipe/dissolve/cut/video), duration, config (JSON)
- `transition_video_layers` — edge_id, asset_id, order, start_at
- `transition_audio_tracks` — edge_id, asset_id, order, start_at
- `assets` — id, file_path, file_name, directory, media_type (video/audio), has_alpha, codec, resolution, frame_rate, duration, file_size
- `asset_tags` — asset_id, tag
- `tags` — tag (unique, reusable list)
- `locales` — code, name
- `subtitle_entries` — id, scene_id, locale_code, start_time, end_time, text
- `decision_translations` — id, decision_key, scene_id, locale_code, label

**Testable outcome**:
- `[x]` Application starts and creates the SQLite database file
- `[x]` All tables exist with correct columns
- `[x]` Flyway migration history is recorded

---

## T-004: FFmpeg Abstraction Layer

**Description**: Build an abstraction layer for FFmpeg CLI interaction. This is a foundational module used by asset analysis, preview compilation, and final compilation. Designed so the underlying tool can be swapped later.

**Work**:
- Define a `VideoProcessor` interface with methods for: probe (get media info), composite (layer videos), transcode, generate HLS segments
- Implement `FFmpegVideoProcessor` using Java `ProcessBuilder` for CLI execution
- Implement `FFprobeMediaAnalyzer` for extracting media metadata (codec, resolution, frame rate, duration, alpha channel detection)
- Build an `FFmpegCommandBuilder` utility for constructing complex FFmpeg commands
- Handle process output/error stream parsing and timeout management
- Validate that FFmpeg/FFprobe are available on the system at startup

**Testable outcome**:
- `[x]` Unit tests for `FFmpegCommandBuilder` produce correct command strings
- `[x]` `FFprobeMediaAnalyzer` extracts metadata from a sample video file (codec, resolution, duration, alpha)
- `[x]` Startup check reports FFmpeg availability status
- `[x]` Interface is clean and implementation-agnostic

---

## T-005: Project Lifecycle API (Backend)

**Description**: Backend API for creating, opening, and configuring projects.

**Work**:
- `POST /api/project/create` — create new project (directory path, name, initial config) → initializes SQLite DB, creates asset directory
- `POST /api/project/open` — open existing project (directory path) → validates structure, loads DB
- `GET /api/project/config` — get current project configuration
- `PUT /api/project/config` — update project configuration
- `GET /api/project/status` — returns whether a project is currently open
- Validate directory structure on open (DB file exists, assets directory exists)

**Testable outcome**:
- `[x]` Create a new project via API → directory created, DB file exists, config stored
- `[x]` Open an existing project via API → config loaded, status returns open
- `[x]` Update config via API → changes persisted in DB
- `[x]` Opening a non-existent or invalid directory returns appropriate error

---

## T-006: Project Lifecycle UI (Frontend)

**Description**: Landing page with project creation wizard and open-project dialog.

**Work**:
- Landing/welcome page shown when no project is open
- "New Project" wizard: project name, directory selection, initial config (resolution, FPS, audio settings)
- "Open Project" dialog: directory path input
- After project is opened/created, navigate to the main editor canvas
- Show project name in the editor header

**Testable outcome**:
- `[x]` User can create a new project through the wizard and land on the editor canvas
- `[x]` User can open an existing project and see the graph (or empty canvas)
- `[x]` Invalid directory shows an error message
- `[x]` Project name is visible in the editor header

---

## T-007: Asset Management (Backend)

**Description**: Backend API for scanning, indexing, and managing assets. Uses the FFmpeg abstraction layer for media analysis.

**Work**:
- `POST /api/assets/scan` — scan the assets directory, index new files, remove deleted ones
- `GET /api/assets` — list all assets (filterable by directory, tags, media type)
- `GET /api/assets/{id}` — get asset details (metadata, tags)
- `POST /api/assets/{id}/tags` — add tags to an asset
- `DELETE /api/assets/{id}/tags/{tag}` — remove a tag
- `GET /api/tags` — list all existing tags (for autocomplete/reuse)
- On scan: for each new video file, run `FFprobeMediaAnalyzer` to detect alpha channel, codec, resolution, frame rate, duration
- On scan: for each new audio file, extract duration, sample rate, codec
- Asset format compatibility validation utility: given a list of video assets for a scene, check if they can be composited (resolution, frame rate compatibility; alpha on non-bottom layers)

**Testable outcome**:
- `[x]` Place video/audio files in the assets directory, call scan → files appear in asset list with correct metadata
- `[x]` Alpha channel correctly detected for ProRes 444 with alpha vs. H.264 without
- `[x]` Tags can be added, removed, and listed; tags are reusable across assets
- `[x]` Compatibility check returns errors for invalid layer combinations

---

## T-008: Asset Management UI (Frontend)

**Description**: Asset browser panel in the editor.

**Work**:
- Side panel or dedicated tab showing asset directory tree
- List view with file name, type icon (video/audio), alpha badge, duration
- Tag management: view, add, remove tags per asset; tag autocomplete from existing tags
- Search/filter by name, directory, tags, media type
- "Scan Assets" button to trigger re-indexing
- Asset detail view showing full metadata

**Testable outcome**:
- `[x]` Assets displayed in a browsable tree/list after scanning
- `[x]` Alpha channel indicator visible on video assets
- `[x]` Tags can be assigned and filtered in the UI
- `[x]` Search by name or tag returns correct results

---

## T-009: Graph Data Model & CRUD API (Backend)

**Description**: Backend API for managing the graph: nodes, edges, and their properties. This is the core data layer for the editor.

**Work**:
- **Nodes**:
  - `POST /api/nodes` — create node (type, name, position)
  - `GET /api/nodes` — list all nodes
  - `GET /api/nodes/{id}` — get node with full details
  - `PUT /api/nodes/{id}` — update node properties
  - `DELETE /api/nodes/{id}` — delete node (cascade delete edges)
  - `PUT /api/nodes/{id}/root` — set node as root
- **Edges**:
  - `POST /api/edges` — create edge (source, target, source_decision_key or source_condition_order)
  - `GET /api/edges` — list all edges
  - `PUT /api/edges/{id}` — update edge properties
  - `DELETE /api/edges/{id}` — delete edge
- **Validation rules** (enforced on save):
  - Exactly one root node
  - State nodes have exactly one outgoing edge
  - Decision nodes: each condition maps to one edge; else is always last
  - Scene node decision keys map to edges
  - Transition only on edges targeting scene nodes
  - Transition duration ≤ 5 seconds
- Auto-save: debounced save on every mutation

**Testable outcome**:
- `[x]` Create, read, update, delete nodes and edges via API
- `[x]` Setting a node as root unsets the previous root
- `[x]` Validation errors returned for invalid graph structures
- `[x]` Auto-save persists changes after mutations

---

## T-010: Graph Editor Canvas (Frontend)

**Description**: The main React Flow canvas with custom node types and edge interaction.

**Work**:
- Custom React Flow node components for each type:
  - **Scene node**: displays name, distinct visual style, end flag indicator
  - **State node**: displays name, distinct visual style
  - **Decision node**: displays name, distinct visual style
- Node creation: toolbar or context menu to add each node type
- Edge creation: drag from node handle to target node
- Node selection, dragging, deletion
- Edge selection, deletion
- Node renaming (inline or via panel)
- Root node visual indicator (e.g., border or icon)
- Sync all changes to backend via API (debounced auto-save)
- Node search: find a node by name

**Testable outcome**:
- `[x]` Three visually distinct node types can be added to the canvas
- `[x]` Nodes can be connected with edges by dragging
- `[x]` Nodes and edges can be selected and deleted
- `[x]` Root node is visually distinguishable
- `[x]` Node positions are saved when dragged and restored on page refresh
- `[x]` Changes persist after page refresh (auto-save round-trip)

---

## T-011: Scene Node Editor (Frontend + Backend)

**Description**: Detail editor panel for configuring a scene node's video layers, audio tracks, decisions, and properties.

**Work**:
- Side panel or modal opens when a scene node is selected
- **Video layers section**: ordered list; add layer (pick from asset browser), reorder, remove, set `start-at`; show error if non-bottom layer lacks alpha
- **Audio tracks section**: ordered list; add track, reorder, remove, set `start-at`
- **Background color**: color picker
- **End flag**: toggle checkbox
- **Decisions section**: add/remove decision keys, set one as default, configure button appearance (timing: timestamp or after-video-ends)
- Computed scene duration displayed (longest layer)
- All changes saved via API

**Testable outcome**:
- `[x]` Add video layers and audio tracks to a scene node from asset browser
- `[x]` Reorder layers; `start-at` values editable
- `[x]` Error shown when a non-bottom video layer has no alpha channel
- `[x]` Scene duration auto-calculated and displayed
- `[x]` Decisions configurable with default selection and timing
- `[x]` End flag togglable; background color selectable
- `[x]` All data persists after save

---

## T-012: State Node Editor (Frontend + Backend)

**Description**: Editor for state node assignments using SpEL expressions.

**Work**:
- Side panel listing state assignments (ordered)
- Each assignment: text input for SpEL expression (e.g., `#VISIT_COUNT = #VISIT_COUNT + 1`)
- Add, remove, reorder assignments
- **SpEL validation endpoint**: `POST /api/spel/validate` — validates expression syntax, returns errors
- Real-time validation feedback in the editor (call validate on blur or debounce)
- Basic syntax highlighting for SpEL in the text input (at minimum: highlight `#variable` references, operators, literals)

**Testable outcome**:
- `[x]` Add multiple state assignments to a state node
- `[x]` Valid SpEL expressions accepted; invalid ones show error messages
- `[x]` `#VARIABLE` references visually highlighted
- `[x]` Assignments persist and load correctly

---

## T-013: Decision Node Editor (Frontend + Backend)

**Description**: Editor for decision node conditions using SpEL expressions.

**Work**:
- Side panel listing conditions (ordered)
- Each condition: SpEL boolean expression input (e.g., `#SCORE > 50`)
- Add, remove, reorder conditions
- The last condition is always `else` (auto-managed, cannot be removed or reordered above others)
- SpEL validation for boolean expressions (reuse T-012 endpoint)
- Each condition maps to an outgoing edge — display which edge each condition connects to
- Syntax highlighting (same as T-012)

**Testable outcome**:
- `[x]` Add conditions with SpEL expressions; else always remains last
- `[x]` Conditions validate as boolean expressions
- `[x]` Each condition visually linked to its outgoing edge
- `[x]` Reordering works (except else stays last)
- `[x]` Data persists correctly

---

## T-014: Edge & Transition Configuration (Frontend + Backend)

**Description**: Configure transitions on edges.

**Work**:
- Edge selection opens a transition config panel
- If edge target is **not** a scene node → transition config is disabled (with explanation)
- If edge target **is** a scene node → show transition options:
  - **Type selector**: none, fade-in, fade-out, crossfade, slide-left, slide-right, wipe, dissolve, cut, video
  - **Duration**: numeric input, enforced max 5 seconds
  - **Video-based transition**: if type is "video", show video layer and audio track config (same UI pattern as scene node layers)
- Backend validates: transition only on scene-targeting edges, duration ≤ 5s

**Testable outcome**:
- `[x]` Selecting an edge to a scene node shows transition options
- `[x]` Selecting an edge to a non-scene node disables transition config
- `[x]` All built-in transition types selectable
- `[x]` Duration > 5s rejected with error
- `[x]` Video-based transition allows adding layers and audio
- `[x]` Transition config persists

---

## T-015: Graph Validation & Warnings (Frontend + Backend)

**Description**: Validate graph structure and display warnings/errors.

**Work**:
- `GET /api/graph/validate` — returns list of warnings and errors
- **Errors** (block compilation):
  - No root node set
  - Scene node with decisions but no default decision
  - State node with != 1 outgoing edge
  - Decision node with no else condition
  - Invalid SpEL expressions
  - Transition on edge not targeting a scene node
- **Warnings** (informational):
  - Unreachable nodes detected (list them)
  - Scene node with no outgoing edges and no end flag
  - No end node in the graph
- Frontend: validation panel/indicator showing errors and warnings
- Clicking a warning/error highlights the relevant node or edge on the canvas

**Testable outcome**:
- `[x]` Creating an invalid graph structure shows appropriate errors
- `[x]` Unreachable nodes trigger a warning (not an error)
- `[x]` Clicking a validation item navigates to / highlights the relevant node
- `[x]` All listed validation rules are enforced

---

## T-016: Scene Preview Compilation

**Description**: Compile a single scene node into a playable video preview using FFmpeg.

**Work**:
- `POST /api/preview/scene/{nodeId}` — triggers compilation
  - Composites all video layers (respecting order, `start-at`, background color) using FFmpeg filter chains
  - Mixes all audio tracks (respecting `start-at`)
  - Uses preview resolution from project config
  - Outputs a single video file (e.g., MP4/H.264 for browser compatibility)
  - Returns file URL when done
- `GET /api/preview/status/{jobId}` — poll compilation progress
- Frontend: "Preview" button on scene nodes → triggers compilation → shows progress → plays result in a modal video player
- Handle compilation errors gracefully (show FFmpeg error output to user)

**Testable outcome**:
- `[x]` Click preview on a scene with multiple video layers → compiles into a single video
- `[x]` Video layers correctly stacked (order, start-at offsets, alpha compositing, background color)
- `[x]` Audio plays at correct offsets
- `[x]` Preview uses the configured preview resolution
- `[x]` Preview plays in the editor modal

---

## T-017: Transition Preview Compilation

**Description**: Compile a transition (built-in effect or video-based) into a playable preview.

**Work**:
- `POST /api/preview/transition/{edgeId}` — triggers compilation
  - For built-in effects: generate a sample transition using FFmpeg filters (e.g., `xfade` filter for crossfade) between two color/test frames
  - For video-based transitions: composite layers same as scene preview
  - Output a short preview video
- Frontend: "Preview" button on edges with transitions → same flow as scene preview

**Testable outcome**:
- `[x]` Preview built-in transitions (fade, crossfade, slide, wipe, dissolve)
- `[x]` Preview video-based transitions with layered video
- `[x]` Preview plays in the editor modal
- `[x]` Duration matches the configured transition duration

---

## T-018: Auto-Save Implementation

**Description**: Implement reliable auto-save for the editor.

**Work**:
- Debounced save: after any graph mutation (node/edge create/update/delete), wait 2 seconds of inactivity, then persist to SQLite
- Save indicator in the UI (e.g., "Saved" / "Saving..." / "Unsaved changes")
- Save all graph state: node positions, properties, edges, transitions
- Handle save failures gracefully (show error, retry)
- Architecture note: use a command/mutation pattern for all graph changes to keep the door open for future undo/redo

**Testable outcome**:
- `[x]` Make changes → save indicator shows "Saving..." then "Saved"
- `[x]` Refresh the page → all changes are preserved
- `[x]` Rapid changes are batched (not saving on every keystroke)
- `[x]` Save failure shows an error notification

---

## T-019: JSON Manifest Generation

**Description**: Export the project graph as a JSON manifest for the compilation engine.

**Work**:
- `POST /api/compile/manifest` — generates the manifest file
- Manifest includes:
  - Project configuration (resolutions, FPS, audio settings, decision timeout, default locale)
  - All reachable nodes (from root, via BFS/DFS — unreachable nodes excluded)
  - All edges between reachable nodes, with transition configs
  - Asset references (file paths relative to assets directory)
  - Localization data (locales, subtitles, decision translations)
- Output: JSON file written to the project directory
- `GET /api/compile/manifest` — download the generated manifest

**Testable outcome**:
- `[x]` Generate manifest for a graph with all node types, edges, and transitions
- `[x]` Unreachable nodes are excluded from the manifest
- `[x]` All asset references resolve to actual files
- `[x]` Manifest JSON is well-structured and complete

---

## T-020: Compilation Engine — Scene & Transition Compilation

**Description**: The compilation engine reads the manifest and compiles all scenes and transitions into output videos at all configured resolutions.

**Work**:
- Separate module/package: `compilation`
- Input: JSON manifest + assets directory
- For each reachable scene: compile video layers + audio into a single video (same logic as preview, but at all compile resolutions)
- For each video-based transition: compile similarly
- For each built-in transition: generate transition video using FFmpeg filters (requires knowing source and target scene's last/first frames)
- Output: compiled video files organized by scene/transition ID and resolution

**Testable outcome**:
- `[x]` Compilation engine processes a manifest and outputs compiled videos
- `[x]` Each scene compiled at all configured resolutions (e.g., 1080p, 720p)
- `[x]` Built-in transitions rendered correctly between scenes
- `[x]` Video-based transitions compiled with layers

---

## T-021: Compilation Engine — HLS Conversion

**Description**: Convert compiled scene and transition videos into HLS streaming format.

**Work**:
- For each compiled video: generate HLS output (`.m3u8` playlist + `.ts` segments)
- Segment duration: configurable, default auto-calculated from FPS and scene duration
- Multi-resolution: generate HLS variant playlist pointing to each resolution's segments
- Output structure: `output/{scene_or_transition_id}/{resolution}/playlist.m3u8` + segments

**Testable outcome**:
- `[x]` Each compiled video produces valid HLS output
- `[x]` `.m3u8` playlists are valid and reference correct `.ts` segments
- `[x]` Multi-resolution variant playlist works
- `[x]` HLS output plays in a browser using hls.js

---

## T-022: Compiled Runtime Server

**Description**: Build the lightweight Java server that serves the compiled game.

**Work**:
- Lightweight embedded HTTP server (e.g., Javalin, or embedded Jetty/Undertow)
- **Static file serving**: serve the client HTML/JS/CSS and HLS video segments
- **Game state API**:
  - `GET /api/game/state` — current state (current scene, all state key values, available decisions)
  - `POST /api/game/decide` — player makes a decision → server evaluates next node(s), updates state, returns next scene + transition info
  - `POST /api/game/restart` — reset state and position to root
- **Graph traversal engine**: from current scene, on decision, traverse through state/decision nodes (executing mutations, evaluating conditions) until the next scene node is reached
- **SpEL evaluation**: evaluate state assignments and decision conditions at runtime
- **Preloading API**: when serving a scene, include preload hints for all transition HLS URLs on direct edges from the current scene
- **State persistence**: save current position + state to a file/SQLite on every state change; load on server start

**Testable outcome**:
- `[x]` Server starts and serves client files
- `[x]` `GET /api/game/state` returns the starting scene (root node)
- `[x]` `POST /api/game/decide` traverses the graph correctly through state and decision nodes
- `[x]` State mutations (SpEL) execute correctly
- `[x]` Decision conditions (SpEL) evaluate correctly
- `[x]` Preload hints included in scene response
- `[x]` State persists across server restarts

---

## T-023: Compiled Runtime Client

**Description**: Build the web-based game player client.

**Work**:
- Single-page HTML/JS application (vanilla JS or lightweight framework)
- **HLS video player**: use hls.js for cross-browser HLS playback
- **Scene playback**: load and play the current scene's HLS stream
- **Freeze frame**: when scene ends, hold the last frame visible
- **Decision buttons**: display decision buttons based on appearance config (timing: at timestamp or after video ends, position: client-managed layout)
- **Decision timeout**: show countdown timer, auto-select default decision after timeout (from project config)
- **Transition playback**: after decision, play the transition video (if any) before the next scene
- **Preloading**: on scene load, preload hinted transition HLS segments in background
- **Restart button**: calls restart API, reloads from root scene
- **Resume on refresh**: on page load, call state API to get current position and resume

**Testable outcome**:
- `[x]` Client loads and plays the starting scene video
- `[x]` Decision buttons appear at the configured time
- `[x]` Selecting a decision triggers the correct transition and next scene
- `[x]` Timeout auto-selects the default decision
- `[x]` Transitions play smoothly between scenes
- `[x]` Refreshing the page resumes from the last position
- `[x]` Restart button works and returns to the beginning
- `[x]` Preloaded transitions play without buffering delay

---

## T-024: Compilation Engine — Full Pipeline & Packaging

**Description**: Wire the full compilation pipeline and produce a distributable package.

**Work**:
- `POST /api/compile/start` — triggers full compilation pipeline:
  1. Generate manifest (T-019)
  2. Compile all scenes and transitions (T-020)
  3. Convert to HLS (T-021)
  4. Bundle runtime server JAR (T-022)
  5. Bundle runtime client (T-023)
  6. Copy all assets and HLS output
  7. Generate startup scripts (`start.sh` for Linux, `start.bat` for Windows)
  8. Generate `README.md` with instructions for offline play and online hosting
- Output: self-contained directory or ZIP in the configured output directory
- `GET /api/compile/status` — poll compilation progress
- Frontend: "Compile" button in the editor → progress view → download/open output when done

**Testable outcome**:
- `[x]` Full compilation from editor produces a complete output package
- `[x]` Package contains: server JAR, client files, HLS assets, startup scripts, README
- `[x]` Running `start.sh` or `start.bat` launches the server and the game is playable in a browser
- `[x]` The game is fully playable offline (no external dependencies — hls.js bundled as classpath resource in T-024b)
- `[x]` README includes clear instructions for online hosting

---

## T-025: Localization Data Model API

**Description**: Backend API for managing localization data. The DB schema exists from T-003; this adds the CRUD endpoints. No editor UI in v1 — this is API-only, included in the manifest for future use.

**Work**:
- `POST /api/locales` — add a locale
- `GET /api/locales` — list locales
- `DELETE /api/locales/{code}` — remove a locale
- `POST /api/subtitles` — add/update subtitle entry for a scene + locale
- `GET /api/subtitles?sceneId=&locale=` — get subtitles
- `POST /api/decision-translations` — add/update decision translation
- `GET /api/decision-translations?sceneId=&locale=` — get translations
- Include localization data in the JSON manifest (T-019)

**Testable outcome**:
- `[x]` CRUD operations on locales, subtitles, and decision translations via API
- `[x]` Localization data appears in the generated JSON manifest
- `[x]` Deleting a locale cascades to its subtitles and translations

---

## T-026: End-to-End Integration Test

**Description**: Validate the full workflow from project creation to compiled game playback.

**Work**:
- Create a test project with:
  - 3+ scene nodes (including one with `end` flag)
  - 1+ state nodes (with counter increment)
  - 1+ decision nodes (with conditions based on state)
  - Multiple decision paths from a scene
  - At least one cycle (loop back to increment counter)
  - Various transitions (built-in + video-based)
  - Unreachable node (should be excluded)
- Walk through the full pipeline:
  1. Create project → add assets → build graph → preview scenes → compile → play
- Document any issues found and fix them

**Testable outcome**:
- `[x]` Full pipeline works end-to-end without manual intervention
- `[x]` Compiled game plays correctly: scenes, decisions, transitions, state changes, cycles
- `[x]` Unreachable nodes excluded from compiled output
- `[x]` Game state persists on refresh; restart works
- `[x]` Decision timeout auto-selects default
- `[x]` Game ends correctly when reaching an end-flagged scene

**Bugs found and fixed during T-026:**
- `[x]` SpEL variable default initialization: `#var + 1` on first use threw NullPointerException when `#var` was uninitialized — fixed by seeding missing `#var` references to `0` before evaluation in `GameEngine.executeAssignment` and `evaluateConditions`
