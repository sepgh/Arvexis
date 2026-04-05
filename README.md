# Arvexis

<p>
  
  <img width="15%" src="https://github.com/sepgh/Arvexis/blob/main/assets/logo.png" align="left" />
  A node-based authoring tool for building interactive video experiences and artistic games. Authors compose a directed graph of scenes, decisions, conditions, and state mutations in a visual editor; the engine compiles it into a self-contained, offline-capable playable package with localization support, customizable runtime styling, menu and pause flows, save/resume support, and configurable presentation.
</p>



---

## What It Does

1. **Author interactive graphs** — Open the editor in a browser and build a node graph:
   - **Scene nodes** — layered video compositing, audio tracks, optional background music, per-layer looping, scene looping, auto-continue, conditional decisions, keyboard-mapped decisions, and an end flag.
   - **State nodes** — SpEL expressions that mutate global variables such as `#VISIT_COUNT = #VISIT_COUNT + 1`.
   - **Condition nodes** — ordered boolean conditions with else/fallback routing.
2. **Manage assets, localization, and presentation** — Upload video/audio assets, organize folders, tag media, define locales, edit subtitles and translated decision labels, and assign scene-level properties such as background color, decision timeout behavior, and default decisions.
3. **Preview quickly** — Compile individual scenes or transitions at preview resolution and watch the result in-browser without leaving the editor.
4. **Validate graphs before export** — Catch missing root nodes, missing default decisions, decisions without matching outgoing edges, invalid transition targets, missing else branches, and unreachable nodes.
5. **Customize the runtime** — Edit runtime CSS in dedicated tabs, tune project settings, and control runtime options such as menu flow, button styling, keyboard-only decision input, subtitles, locale selection, music behavior, and display preferences.
6. **Compile and export** — Run the full pipeline: FFmpeg compositing → HLS conversion → manifest generation → packaging. The editor produces a runnable `dist/` folder and a `dist.zip` bundle.
7. **Play offline or self-host** — Extract `dist.zip` and run `./start.sh` (Linux/macOS) or `start.bat` (Windows). Open `http://localhost:8090` in any browser — no internet connection required for local playback.

---

## Available Features

### Editor Features

- **Visual graph authoring** with React Flow for scene, state, and condition nodes.
- **Scene editing** with layered video compositing, audio tracks, layer ordering, start offsets, freeze-last-frame support, and per-layer looping.
- **Scene properties** including end nodes, auto-continue, scene-level loop video, background color, and background music selection.
- **Decision authoring** with default decisions, keyboard hotkey assignment, conditional availability expressions, and scene decision ordering.
- **State mutation nodes** using Spring SpEL.
- **Conditional branching** with ordered condition nodes and explicit else/fallback logic.
- **Localization tools** for locale management, scene subtitles, and translated decision labels.
- **Asset management** for upload, folder creation, tagging, and media browsing.
- **Validation tooling** for root/end-node issues, missing default decisions, missing scene decision edges, invalid transition targets, missing else branches, and unreachable nodes.
- **Preview compilation** for individual scenes and transitions.
- **Project settings** for assets/output paths, preview and compile resolutions, FPS, audio settings, decision timeout, default locale, default background color, FFmpeg threads, hidden decision buttons, and input indicators.
- **Custom CSS editing** split into `buttons.css`, `subtitles.css`, and `custom.css`, plus an in-editor runtime CSS reference tab.
- **Auto-save** of project state in the embedded SQLite database.

### Runtime Features

- **Main menu** with Continue, New Game, and Settings actions.
- **Pause overlay** for in-game control and quick access to settings.
- **Settings panel** for music volume, video volume, music toggle, button placement, button colors, subtitles on/off, locale selection, and resolution.
- **Save/resume support** with saved-game detection and Continue flow.
- **Offline playback** from the packaged runtime bundle.
- **Background music playback** during scenes, with current music preserved when a scene does not override it.
- **Localized subtitles and translated decision labels** when locales are configured.
- **Freeze-frame decision UI** when a scene ends and the player needs to choose the next path.
- **Keyboard decision input** with per-decision hotkeys, optional visible key hints, and project-level hidden-button mode.
- **Bottom-screen input indicator** for keyboard-only decision mode.
- **Decision timeout fallback** for automatic default-choice selection.
- **Conditional decisions** evaluated from current runtime state.
- **Scene auto-continue** when no explicit decision is required.
- **Looping scene playback** while waiting for decisions when enabled.
- **Decision, transition, and next-scene preloading** to keep playback smooth.
- **End screen** with replay and return-to-menu actions.

### Packaging and Runtime Output

- **Self-contained Java server/client bundle** for local or hosted playback.
- **Compiled multi-resolution HLS output** for scenes and transitions, with master playlists for browser-friendly delivery.
- **Generated manifest** filtered to the reachable graph and localization content used by the game.
- **Included runtime styling files** with `default.css`, `buttons.css`, `subtitles.css`, and `custom.css`.
- **Bundled startup scripts and package README** for quick local launch on Linux/macOS and Windows.
- **Referenced background-music assets copied into the package** so exported projects remain self-contained.
- **Runnable `dist/` folder plus `dist.zip` archive** for distribution.
- **Cross-platform output** for Linux and Windows.

---

## Why This Project Is Useful

- **For interactive storytelling** — It gives creators a structured way to build branching narratives without hand-coding every path.
- **For artistic games and video essays** — The engine is well-suited to experiences where video, audio, and decisions are the core medium.
- **For rapid iteration** — The editor supports previews, asset management, and in-browser authoring, which makes experimentation faster.
- **For offline distribution** — The final package can run without internet access, making it practical for exhibitions, installations, and local demos.
- **For customization** — Runtime CSS and settings let creators tailor the player presentation to their project identity.
- **For maintainability** — The graph model, manifest-driven compilation, and separated editor/runtime architecture keep the system easier to extend.

---

## Repository Layout

```
engine/
├── docs/
│   ├── system-design.md     Full system design, graph rules, and design decisions
│   └── tasks.md             Ordered implementation tasks with completion status
│
├── editor/
│   ├── README.md            Editor setup, running instructions, full API reference
│   ├── backend/             Java Spring Boot backend (REST API, FFmpeg, SQLite)
│   └── frontend/            React + React Flow frontend (Vite, TypeScript, Tailwind)
│
├── runtime/                 Compiled runtime — lightweight Java server + web client
│
├── mockup/                  Early UI mockup (React, not production code)
│
└── README.md                This file
```

---

## Where to Go From Here

| Goal | Document |
|------|----------|
| Understand the design and data model | [`docs/system-design.md`](docs/system-design.md) |
| Check implementation progress | [`docs/tasks.md`](docs/tasks.md) |
| Set up and run the editor | [`editor/README.md`](editor/README.md) |
| Browse the full REST API reference | [`editor/README.md → API Reference`](editor/README.md#api-reference) |

---

## Quick Start

### Compiled Binary

Quickest way to run the editor and start a new project is to download available binaries in [releases](https://github.com/sepgh/Arvexis/releases). 

### Prerequisites for building and running from source

| Tool | Version | Notes |
|------|---------|-------|
| Java JDK | 21+ | `java -version` |
| Maven | 3.9+ | `mvn -v` |
| Node.js | 18+ | `node -v` |
| FFmpeg | Any recent | `ffmpeg -version` — required for compilation and preview |

### Run the Editor

```bash
# Easy way on linux
./build.sh
```

Or make native binary

```
./build-native.sh
```

Or

```bash
# 1. Build the frontend
cd editor/frontend
npm install

# 2. Build and start the backend. It will host frontend too.
cd editor/backend
mvn package -DskipTests
java -jar target/editor-backend-{VERSION}.jar   # replace with valid version
```

Open **http://localhost:8080** in a browser.

### Play a Compiled Package

```bash
# Extract the dist.zip downloaded from the editor, then:
./start.sh          # Linux / macOS
start.bat           # Windows
```

Open **http://localhost:8090** in a browser.

---

## Tech Stack

- **Editor backend** — Java 21, Spring Boot, SQLite (Flyway migrations), Spring SpEL
- **Editor frontend** — React 18, React Flow, Vite, TypeScript, Tailwind CSS
- **Video processing** — FFmpeg (CLI, abstraction layer)
- **Compiled runtime** — Lightweight embedded Java HTTP server, hls.js (bundled, no CDN)
- **Streaming** — HLS (`.m3u8` + `.ts` segments), multi-resolution

---

## Screenshots

<img width="1864" height="1200" alt="image" src="https://github.com/user-attachments/assets/9c19f357-cbb9-4fba-8413-33641c14c23b" />
<img width="1864" height="1200" alt="image" src="https://github.com/user-attachments/assets/9eae2ac9-7eed-4643-bb84-892c8155f1f6" />
<img width="1866" height="1200" alt="image" src="https://github.com/user-attachments/assets/cc11aecd-a032-4375-84c8-771f14a1922d" />
<img width="1866" height="1200" alt="image" src="https://github.com/user-attachments/assets/c1553278-f130-4a75-90d2-780a43f3fc08" />
<img width="1866" height="1200" alt="image" src="https://github.com/user-attachments/assets/ee5f29b1-6da2-41d3-9b03-cb2cf832193d" />



