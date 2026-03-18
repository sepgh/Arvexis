ALTER TABLE node_video_layers        ADD COLUMN freeze_last_frame INTEGER NOT NULL DEFAULT 0;
ALTER TABLE transition_video_layers  ADD COLUMN freeze_last_frame INTEGER NOT NULL DEFAULT 0;
