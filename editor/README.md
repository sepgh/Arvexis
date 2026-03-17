# Interactive Video Engine — Editor

A node-based editor for authoring interactive video experiences. Authors assemble a directed graph of scenes, decisions, and state mutations; the engine compiles it into a self-contained playable package.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Directory Structure](#directory-structure)
- [Backend](#backend)
  - [Building](#building-the-backend)
  - [Running](#running-the-backend)
  - [Configuration](#backend-configuration)
  - [API Reference](#api-reference)
- [Frontend](#frontend)
  - [Installing Dependencies](#installing-frontend-dependencies)
  - [Running (Dev)](#running-the-frontend-dev-server)
  - [Building (Production)](#building-the-frontend-for-production)
- [Development Workflow](#development-workflow)
- [Project Lifecycle](#project-lifecycle)
- [Task Progress](#task-progress)

---

## Prerequisites

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| Java | 21 | JDK (not JRE) |
| Maven | 3.9+ | `mvn -v` |
| Node.js | 18+ | `node -v` |
| npm | 9+ | Bundled with Node |
| FFmpeg | Any recent | `ffmpeg` and `ffprobe` must be on `PATH` |

FFmpeg is required for scene preview compilation and asset analysis. The editor starts without it, but compilation and preview features will be unavailable.

---

## Directory Structure

```
editor/
├── backend/                  Java Spring Boot backend
│   ├── pom.xml
│   └── src/
│       ├── main/
│       │   ├── java/com/engine/editor/
│       │   │   ├── EditorApplication.java
│       │   │   ├── config/           Spring configuration beans
│       │   │   ├── controller/       REST controllers + DTOs
│       │   │   │   └── dto/          Request/response records
│       │   │   ├── exception/        Custom exceptions + global handler
│       │   │   ├── ffmpeg/           FFmpeg abstraction layer
│       │   │   ├── model/            Plain domain model classes
│       │   │   ├── repository/       (future: Spring Data repositories)
│       │   │   └── service/          Business logic services
│       │   └── resources/
│       │       ├── application.properties
│       │       └── db/migration/     Flyway SQL migrations
│       └── test/
│           ├── java/com/engine/editor/
│           │   └── ffmpeg/           FFmpegCommandBuilder unit tests
│           └── resources/
│               └── application-test.properties
│
├── frontend/                 React + Vite frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig*.json
│   ├── index.html
│   └── src/
│       ├── main.tsx          Entry point
│       ├── App.tsx           Root component / view routing
│       ├── index.css         Global styles (Tailwind v4 + React Flow overrides)
│       ├── vite-env.d.ts     Vite type declarations
│       ├── api/              Fetch-based API clients
│       ├── components/
│       │   └── layout/       RootLayout with header
│       ├── hooks/            Custom React hooks
│       ├── lib/              Utility functions
│       ├── pages/            Full-page view components
│       ├── store/            Zustand global state
│       └── types/            TypeScript interfaces
│
└── README.md                 This file
```

---

## Backend

### Building the Backend

```bash
cd editor/backend
mvn package -DskipTests
```

The executable JAR is produced at `target/editor-backend-0.0.1-SNAPSHOT.jar`.

To compile and run all tests:

```bash
cd editor/backend
mvn test
```

### Running the Backend

```bash
java -jar editor/backend/target/editor-backend-0.0.1-SNAPSHOT.jar
```

The server starts on **port 8080**.

By default the editor state database is stored at `~/.engine-editor/editor.db`. Override with:

```bash
java -jar editor-backend-0.0.1-SNAPSHOT.jar --editor.db.path=/path/to/editor.db
```

> **Note**: This startup database is separate from the project database. Each project has its own `project.db` inside its directory, created/opened via the Project API.

### Backend Configuration

All settings live in `src/main/resources/application.properties`:

| Property | Default | Description |
|----------|---------|-------------|
| `server.port` | `8080` | HTTP port |
| `editor.db.path` | `~/.engine-editor/editor.db` | Startup SQLite path |
| `spring.jpa.hibernate.ddl-auto` | `none` | Schema managed by Flyway |
| `logging.level.com.engine.editor` | `INFO` | Application log level |

Test overrides are in `src/test/resources/application-test.properties`.

### API Reference

#### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Returns `{"status":"ok"}` |

#### Project Lifecycle

| Method | Path | Body / Params | Description |
|--------|------|---------------|-------------|
| `POST` | `/api/project/create` | `CreateProjectRequest` JSON | Create a new project directory and database |
| `POST` | `/api/project/open` | `{"directoryPath":"..."}` | Open an existing project |
| `GET` | `/api/project/status` | — | Whether a project is currently open |
| `GET` | `/api/project/config` | — | Current project configuration |
| `PUT` | `/api/project/config` | `UpdateProjectConfigRequest` JSON | Patch project configuration |

**`CreateProjectRequest` fields** (all optional except `directoryPath` and `name`):

```json
{
  "directoryPath": "/path/to/my-project",
  "name": "My Project",
  "assetsDirectory": "/path/to/my-project/assets",
  "outputDirectory": "/path/to/my-project/output",
  "previewResolution": "1280x720",
  "compileResolutions": ["2K", "1080p", "720p"],
  "fps": 30,
  "audioSampleRate": 44100,
  "audioBitRate": 128,
  "decisionTimeoutSecs": 5.0
}
```

**Project directory structure** created by `/api/project/create`:

```
<directoryPath>/
├── project.db    SQLite database (Flyway-managed schema)
├── assets/       Place source video/audio files here
└── output/       Compilation output goes here
```

#### Graph — Nodes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/nodes` | Create node (`name`, `type`: `scene`/`state`/`decision`, `posX`, `posY`) |
| `GET` | `/api/nodes` | List all nodes |
| `GET` | `/api/nodes/{id}` | Get single node |
| `PUT` | `/api/nodes/{id}` | Update node (`name`, `posX`, `posY`, `isEnd`) |
| `DELETE` | `/api/nodes/{id}` | Delete node and all incident edges |
| `PUT` | `/api/nodes/{id}/root` | Set this node as the graph root |

#### Graph — Edges

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/edges` | Create edge (`sourceNodeId`, `targetNodeId`, `sourceDecisionKey`?, `sourceConditionOrder`?) |
| `GET` | `/api/edges` | List all edges |
| `GET` | `/api/edges/{id}` | Get single edge |
| `PUT` | `/api/edges/{id}` | Update edge routing keys |
| `DELETE` | `/api/edges/{id}` | Delete edge |
| `GET` | `/api/edges/{id}/transition` | Get current transition for an edge |
| `PUT` | `/api/edges/{id}/transition` | Set/update transition (`type`, `duration`) |

#### Graph — Validation

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/validation` | Returns `{"errors":[…],"warnings":[…]}` |

#### Scene Node Editor

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/nodes/{id}/scene` | Get full scene data (layers, audio, decisions) |
| `PUT` | `/api/nodes/{id}/scene/layers` | Save ordered video layers (`assetId`, `startAt`, `layerOrder`) |
| `PUT` | `/api/nodes/{id}/scene/audio` | Save ordered audio tracks (`assetId`, `startAt`, `trackOrder`) |
| `PUT` | `/api/nodes/{id}/scene/decisions` | Save decisions (`decisionKey`, `isDefault`, `decisionOrder`) |

#### State Node Editor

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/nodes/{id}/state` | Get state data (assignments) |
| `PUT` | `/api/nodes/{id}/state/assignments` | Save SpEL assignments (`expression`, `assignmentOrder`) |

#### Decision Node Editor

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/nodes/{id}/decision` | Get decision data (conditions) |
| `PUT` | `/api/nodes/{id}/decision/conditions` | Save SpEL conditions (`expression`, `conditionOrder`, `isElse`) |

#### SpEL Validation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/spel/validate` | Validate a SpEL expression (`{"expression":"...","mode":"assignment"\|"condition"}`) |

#### Edge Transition — Video-Based

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/api/edges/{id}/transition/layers` | Save video layers for video-based transition |
| `PUT` | `/api/edges/{id}/transition/audio` | Save audio tracks for video-based transition |

#### Asset Management

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/assets/scan` | Scan assets directory and index new files |
| `GET` | `/api/assets` | List all assets (filter: `?directory=&mediaType=&tags=`) |
| `GET` | `/api/assets/{id}` | Get single asset |
| `GET` | `/api/tags` | List all tag strings |
| `POST` | `/api/assets/{id}/tags` | Add a tag to an asset (`{"tag":"..."}`) |
| `DELETE` | `/api/assets/{id}/tags/{tag}` | Remove a tag from an asset |
| `POST` | `/api/assets/compatibility-check` | Check two assets are compatible for compositing |

#### Preview (Async Jobs)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/preview/scene/{nodeId}` | Start scene preview compilation job |
| `POST` | `/api/preview/transition/{edgeId}` | Start transition preview job |
| `GET` | `/api/preview/status/{jobId}` | Poll job status (`status`, `progress`, `statusText`) |
| `POST` | `/api/preview/cancel/{jobId}` | Cancel a running preview job |
| `GET` | `/api/preview/file/{jobId}` | Stream the compiled preview MP4 |

**Job status values**: `running` · `done` · `failed` · `cancelled`

#### Compile, Manifest & Packaging

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/compile/manifest` | Generate `manifest.json` from current project state |
| `GET` | `/api/compile/manifest` | Download the last generated `manifest.json` |
| `POST` | `/api/compile/run` | Start full compilation pipeline (returns async job, poll via `/api/preview/status/{jobId}`) |
| `POST` | `/api/compile/start` | Alias for `/run` |
| `GET` | `/api/compile/download` | Download the compiled `dist.zip` package |

**Compile pipeline stages** (progress reported during polling):
1. Scene compilation (FFmpeg composite per resolution) — 5–50%
2. Transition compilation — 51–80%
3. HLS conversion + master playlist — 81–91%
4. Packaging (ZIP: manifest + output + runtime.jar + scripts) — 92–100%

**`dist.zip` contents:**
```
dist.zip
├── manifest.json
├── runtime.jar         Self-contained server (start with java -jar runtime.jar)
├── start.sh            Linux/macOS launcher
├── start.bat           Windows launcher
├── README.md           End-user instructions
└── output/
    └── {nodeId}/
        ├── {res}/playlist.m3u8
        └── {res}/*.ts
```

#### Localization

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/locales` | List all locales |
| `POST` | `/api/locales` | Add or update locale (`code`, `name`) |
| `DELETE` | `/api/locales/{code}` | Delete locale (cascades to subtitles and translations) |
| `GET` | `/api/subtitles` | List subtitle entries (filter: `?sceneId=&locale=`) |
| `POST` | `/api/subtitles` | Add or update subtitle entry (`id`?, `sceneId`, `localeCode`, `startTime`, `endTime`, `text`) |
| `DELETE` | `/api/subtitles/{id}` | Delete subtitle entry |
| `GET` | `/api/decision-translations` | List decision translations (filter: `?sceneId=&locale=`) |
| `POST` | `/api/decision-translations` | Add or update translation (`id`?, `decisionKey`, `sceneId`, `localeCode`, `label`) |
| `DELETE` | `/api/decision-translations/{id}` | Delete translation |

Localization data is automatically included in the compiled manifest under the `localization` key.

---

#### Runtime Server API

> The runtime server is a separate process started from the compiled package. Default port: **8090**.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/game/state` | Current scene, decisions, variables, `isEnd`, preload URLs |
| `POST` | `/api/game/decide` | Submit decision (`{"decisionKey":"A"}`); returns transition info + next state |
| `POST` | `/api/game/restart` | Reset to root node, clear all variables |
| `GET` | `/hls/{id}/master.m3u8` | Serve HLS master playlist |
| `GET` | `/hls/{id}/{res}/playlist.m3u8` | Serve resolution variant playlist |
| `GET` | `/hls/{id}/{res}/*.ts` | Serve HLS segment |
| `GET` | `/` | Serve the game client (`index.html`) |
| `GET` | `/{file}` | Serve static client assets (`game.js`, `hls.min.js`, etc.) |

---

## Frontend

### Installing Frontend Dependencies

```bash
cd editor/frontend
npm install
```

### Running the Frontend Dev Server

Start the backend first, then:

```bash
cd editor/frontend
npm run dev
```

Opens at **http://localhost:5173**. All `/api/*` requests are proxied to `http://localhost:8080`.

### Building the Frontend for Production

```bash
cd editor/frontend
npm run build
```

Output is written to `editor/frontend/dist/`. In production the backend serves these static files directly (configured in a later task).

---

## Development Workflow

**Typical session:**

```bash
# Terminal 1 — backend
cd editor/backend
mvn package -DskipTests
java -jar target/editor-backend-0.0.1-SNAPSHOT.jar

# Terminal 2 — frontend
cd editor/frontend
npm run dev
```

Then open http://localhost:5173.

**Running backend tests:**

```bash
cd editor/backend
mvn test
```

**TypeScript type-check only (no emit):**

```bash
cd editor/frontend
npx tsc -b --noEmit
```

---

## Project Lifecycle

The editor is a **single-project application**: one project is open at a time. On startup no project is loaded.

1. **Create** — `POST /api/project/create` creates a directory, initialises `project.db`, runs Flyway migrations, and saves the initial project config.
2. **Open** — `POST /api/project/open` validates the directory contains `project.db` and `assets/`, applies any pending migrations, and loads the config.
3. **Edit** — all graph, asset, and config changes persist to the project's SQLite database.
4. **Compile** — `POST /api/compile/run` runs the full pipeline (scene/transition FFmpeg composite → HLS → packaging). Poll progress via `/api/preview/status/{jobId}`. Download the result as `dist.zip` from `GET /api/compile/download`.
5. **Play** — extract `dist.zip`, run `./start.sh` (or `start.bat` on Windows). Open `http://localhost:8090` in a browser.

---

## Task Progress

Tasks are tracked in [`../docs/tasks.md`](../docs/tasks.md).

| Task | Status | Description |
|------|--------|-------------|
| T-001 | ✅ Done | Spring Boot backend setup, health endpoint |
| T-002 | ✅ Done | React/Vite frontend setup, empty canvas |
| T-003 | ✅ Done | SQLite schema, Flyway migrations |
| T-004 | ✅ Done | FFmpeg abstraction layer, `FFmpegCommandBuilder` (11 unit tests), `FFprobeMediaAnalyzer`, startup check |
| T-005 | ✅ Done | Project lifecycle API (create, open, config, status) |
| T-006 | ✅ Done | Project lifecycle UI — welcome page, new project wizard, open dialog, project name in header |
| T-007 | ✅ Done | Asset management backend — scan, index, alpha detection, tags, compatibility check |
| T-008 | ✅ Done | Asset management UI — browser panel, scan button, alpha badge, tag management, search/filter |
| T-009 | ✅ Done | Graph data model & CRUD API — nodes/edges CRUD, set-root, transition validation |
| T-010 | ✅ Done | Graph editor canvas — scene/state/decision nodes, drag, connect, delete, rename, set-root |
| T-011 | ✅ Done | Scene node editor — video layers, audio tracks, decisions, duration, end flag, bg color |
| T-012 | ✅ Done | State node editor — SpEL assignments, live validation, syntax highlighting |
| T-013 | ✅ Done | Decision node editor — ordered SpEL conditions, else always last, edge mapping |
| T-014 | ✅ Done | Edge & transition configuration — type selector, duration, video-based layers/audio, disabled on non-scene targets |
| T-015 | ✅ Done | Graph validation — errors (no root, bad state/decision, invalid transitions) + warnings (unreachable, no end), clickable panel |
| T-016 | ✅ Done | Scene preview — async job, `POST /api/preview/scene/{nodeId}`, poll status, serve MP4, ▶ Preview button + modal in SceneEditor |
| T-017 | ✅ Done | Transition preview — built-in effects via xfade filter, video-based via composite, ▶ Preview button + modal in TransitionEditor |
| T-018 | ✅ Done | Auto-save — mutation tracker in apiClient, `saveStatus` store, `SaveIndicator` in header (Saving… / Saved / Error) |
| T-019 | ✅ Done | JSON manifest — BFS reachability, all node/edge/transition/asset/locale data, `POST /api/compile/manifest` + `GET` download, header button |
| T-020 | ✅ Done | Compilation engine — `CompileService` reads manifest, composites scenes+transitions at all compile resolutions, `POST /api/compile/run` async job |
| T-021 | ✅ Done | HLS conversion — `generateHls` per resolution, `master.m3u8` multi-resolution variant playlist, output `{id}/{res}/playlist.m3u8` + `.ts` segments |
| T-022 | ✅ Done | Compiled runtime server — lightweight JDK `HttpServer`, `GameEngine` (graph traversal + SpEL), `StateStore` (JSON persistence), `GET /api/game/state`, `POST /api/game/decide`, `POST /api/game/restart`, HLS file serving |
| T-023 | ✅ Done | Compiled runtime client — single-page HTML/JS, hls.js playback, decisions with timeout + countdown, freeze frame, transition playback, preloading, restart, resume on refresh |
| T-024 | ✅ Done | Full pipeline & packaging — stage 5 bundles `runtime.jar` (classpath resource), `start.sh`/`start.bat`, `README.md`, creates `dist.zip` (manifest + HLS output + runtime); `GET /api/compile/download` serves ZIP; header Download button appears on completion |
| T-024b | ✅ Done | hls.js offline bundling — `hls.min.js` (413 KB, v1.5.13) embedded in runtime JAR as classpath resource; `index.html` loads from `/hls.min.js` (no CDN dependency) |
| T-025 | ✅ Done | Localization API — `LocalizationService` + `LocalizationController`; `POST/GET/DELETE /api/locales`, `POST/GET/DELETE /api/subtitles`, `POST/GET/DELETE /api/decision-translations`; cascade delete via FK; manifest `localization` section already populated by `ManifestService` |
| T-026 | ✅ Done | End-to-end integration test — 7-node graph (4 scenes, 1 state, 1 decision, 1 unreachable), 4 transitions (crossfade/fade_in/dissolve/slide_left), cycle with counter, SpEL `#counter >= 3` gate to end scene; bug fixed: SpEL variables now default to `0` on first use (`seedMissingVars` in `GameEngine`) |
