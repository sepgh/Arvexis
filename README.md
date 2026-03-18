# Arvexis

A node-based authoring tool for building interactive video experiences and artistic games. Authors compose a directed graph of scenes, conditions, and state mutations in a visual editor; the engine compiles it into a self-contained, offline-capable playable package.

---

## What It Does

1. **Author** — Open the editor in a browser. Build a graph of nodes:
   - **Scene nodes** — video layers composited over each other, with audio tracks, decision buttons, and an optional end flag.
   - **State nodes** — SpEL expressions that mutate global variables (e.g. `#VISIT_COUNT = #VISIT_COUNT + 1`).
   - **Condition nodes** — ordered SpEL boolean conditions that route the player along different edges.
2. **Preview** — Compile individual scenes or transitions at preview resolution and watch the result in-browser without leaving the editor.
3. **Compile** — Run the full pipeline: FFmpeg compositing → HLS conversion → packaging. Downloads a `dist.zip` containing a self-contained runtime.
4. **Play** — Extract `dist.zip` and run `./start.sh` (Linux/macOS) or `start.bat` (Windows). Open `http://localhost:8090` in any browser — no internet connection required.

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

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Java JDK | 21+ | `java -version` |
| Maven | 3.9+ | `mvn -v` |
| Node.js | 18+ | `node -v` |
| FFmpeg | Any recent | `ffmpeg -version` — required for compilation and preview |

### Run the Editor

```bash
# 1. Build and start the backend
cd editor/backend
mvn package -DskipTests
java -jar target/editor-backend-0.0.1-SNAPSHOT.jar

# 2. In a second terminal, start the frontend dev server
cd editor/frontend
npm install
npm run dev
```

Open **http://localhost:5173** in a browser.

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
