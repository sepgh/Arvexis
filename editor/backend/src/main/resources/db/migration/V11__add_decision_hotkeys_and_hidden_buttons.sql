ALTER TABLE scene_decisions ADD COLUMN keyboard_key TEXT;
ALTER TABLE project_config ADD COLUMN hide_decision_buttons INTEGER NOT NULL DEFAULT 0;
