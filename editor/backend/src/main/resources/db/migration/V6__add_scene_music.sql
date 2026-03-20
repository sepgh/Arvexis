-- V6: Add background music asset reference to scene nodes
ALTER TABLE nodes ADD COLUMN music_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL;
