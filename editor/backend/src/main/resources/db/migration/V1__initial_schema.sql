-- ============================================================
-- V1: Initial schema for the Interactive Video Engine editor
-- ============================================================

-- Project-level configuration (single row enforced by CHECK id = 1)
CREATE TABLE IF NOT EXISTS project_config (
    id                      INTEGER PRIMARY KEY CHECK (id = 1),
    name                    TEXT    NOT NULL,
    assets_directory        TEXT,
    output_directory        TEXT,
    preview_resolution      TEXT,
    compile_resolutions     TEXT,   -- JSON array, e.g. '["2K","1080p","720p"]'
    fps                     INTEGER NOT NULL DEFAULT 30,
    audio_sample_rate       INTEGER NOT NULL DEFAULT 44100,
    audio_bit_rate          INTEGER NOT NULL DEFAULT 128,
    decision_timeout_secs   REAL    NOT NULL DEFAULT 5.0,
    default_locale_code     TEXT
);

-- ============================================================
-- Localization
-- ============================================================

CREATE TABLE IF NOT EXISTS locales (
    code    TEXT PRIMARY KEY,
    name    TEXT NOT NULL
);

-- ============================================================
-- Assets
-- ============================================================

CREATE TABLE IF NOT EXISTS assets (
    id          TEXT PRIMARY KEY,
    file_path   TEXT NOT NULL UNIQUE,
    file_name   TEXT NOT NULL,
    directory   TEXT,
    media_type  TEXT NOT NULL CHECK (media_type IN ('video', 'audio')),
    has_alpha   INTEGER NOT NULL DEFAULT 0,
    codec       TEXT,
    resolution  TEXT,
    frame_rate  REAL,
    duration    REAL,
    file_size   INTEGER
);

CREATE TABLE IF NOT EXISTS tags (
    tag TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS asset_tags (
    asset_id    TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    tag         TEXT NOT NULL REFERENCES tags(tag)  ON DELETE CASCADE,
    PRIMARY KEY (asset_id, tag)
);

-- ============================================================
-- Graph: Nodes
-- ============================================================

CREATE TABLE IF NOT EXISTS nodes (
    id                          TEXT PRIMARY KEY,
    name                        TEXT NOT NULL,
    type                        TEXT NOT NULL CHECK (type IN ('scene', 'state', 'decision')),
    is_root                     INTEGER NOT NULL DEFAULT 0,
    is_end                      INTEGER NOT NULL DEFAULT 0,
    background_color            TEXT,
    decision_appearance_config  TEXT,   -- JSON
    pos_x                       REAL    NOT NULL DEFAULT 0,
    pos_y                       REAL    NOT NULL DEFAULT 0
);

-- Video layers attached to a scene node
CREATE TABLE IF NOT EXISTS node_video_layers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id     TEXT    NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    asset_id    TEXT    NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    layer_order INTEGER NOT NULL,
    start_at    REAL    NOT NULL DEFAULT 0
);

-- Audio tracks attached to a scene node
CREATE TABLE IF NOT EXISTS node_audio_tracks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id     TEXT    NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    asset_id    TEXT    NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    track_order INTEGER NOT NULL,
    start_at    REAL    NOT NULL DEFAULT 0
);

-- SpEL assignments for a state node (ordered)
CREATE TABLE IF NOT EXISTS node_state_assignments (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id          TEXT    NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    assignment_order INTEGER NOT NULL,
    expression       TEXT    NOT NULL
);

-- SpEL boolean conditions for a decision node (ordered; last row is else)
CREATE TABLE IF NOT EXISTS node_decision_conditions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id         TEXT    NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    condition_order INTEGER NOT NULL,
    expression      TEXT    NOT NULL,
    is_else         INTEGER NOT NULL DEFAULT 0
);

-- Decisions defined on a scene node
CREATE TABLE IF NOT EXISTS scene_decisions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id        TEXT    NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    decision_key   TEXT    NOT NULL,
    is_default     INTEGER NOT NULL DEFAULT 0,
    decision_order INTEGER NOT NULL,
    UNIQUE (node_id, decision_key)
);

-- ============================================================
-- Graph: Edges
-- ============================================================

CREATE TABLE IF NOT EXISTS edges (
    id                    TEXT PRIMARY KEY,
    source_node_id        TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    source_decision_key   TEXT,       -- set when source is a scene node
    source_condition_order INTEGER,   -- set when source is a decision node
    target_node_id        TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE
);

-- Transition config attached to an edge (only valid when target is a scene node)
CREATE TABLE IF NOT EXISTS edge_transitions (
    edge_id  TEXT PRIMARY KEY REFERENCES edges(id) ON DELETE CASCADE,
    type     TEXT NOT NULL DEFAULT 'none'
                 CHECK (type IN ('none','fade_in','fade_out','crossfade',
                                 'slide_left','slide_right','wipe',
                                 'dissolve','cut','video')),
    duration REAL,
    config   TEXT    -- JSON (extra effect params)
);

-- Video layers for a video-based transition
CREATE TABLE IF NOT EXISTS transition_video_layers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    edge_id     TEXT    NOT NULL REFERENCES edges(id) ON DELETE CASCADE,
    asset_id    TEXT    NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    layer_order INTEGER NOT NULL,
    start_at    REAL    NOT NULL DEFAULT 0
);

-- Audio tracks for a video-based transition
CREATE TABLE IF NOT EXISTS transition_audio_tracks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    edge_id     TEXT    NOT NULL REFERENCES edges(id) ON DELETE CASCADE,
    asset_id    TEXT    NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    track_order INTEGER NOT NULL,
    start_at    REAL    NOT NULL DEFAULT 0
);

-- ============================================================
-- Localization: Subtitles & Decision Translations
-- ============================================================

CREATE TABLE IF NOT EXISTS subtitle_entries (
    id          TEXT PRIMARY KEY,
    scene_id    TEXT NOT NULL REFERENCES nodes(id)   ON DELETE CASCADE,
    locale_code TEXT NOT NULL REFERENCES locales(code) ON DELETE CASCADE,
    start_time  REAL NOT NULL,
    end_time    REAL NOT NULL,
    text        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_translations (
    id           TEXT PRIMARY KEY,
    decision_key TEXT NOT NULL,
    scene_id     TEXT NOT NULL REFERENCES nodes(id)    ON DELETE CASCADE,
    locale_code  TEXT NOT NULL REFERENCES locales(code) ON DELETE CASCADE,
    label        TEXT NOT NULL
);
