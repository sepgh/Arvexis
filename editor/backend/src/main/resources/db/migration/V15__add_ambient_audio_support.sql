CREATE TABLE IF NOT EXISTS ambient_zones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    asset_id TEXT REFERENCES assets(id) ON DELETE RESTRICT,
    default_volume REAL NOT NULL DEFAULT 1.0,
    default_fade_ms INTEGER NOT NULL DEFAULT 1000,
    loop INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE nodes ADD COLUMN ambient_action TEXT NOT NULL DEFAULT 'inherit';
ALTER TABLE nodes ADD COLUMN ambient_zone_id TEXT;
ALTER TABLE nodes ADD COLUMN ambient_volume_override REAL;
ALTER TABLE nodes ADD COLUMN ambient_fade_ms_override INTEGER;

CREATE TABLE IF NOT EXISTS edge_ambient (
    edge_id TEXT PRIMARY KEY REFERENCES edges(id) ON DELETE CASCADE,
    ambient_action TEXT NOT NULL DEFAULT 'inherit',
    ambient_zone_id TEXT,
    ambient_volume_override REAL,
    ambient_fade_ms_override INTEGER
);
