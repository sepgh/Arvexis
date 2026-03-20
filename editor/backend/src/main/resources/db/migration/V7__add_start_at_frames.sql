-- V7: Add frame-based start offset (start_at_frames) to video layers and audio tracks.
-- When set, frame offset takes priority over seconds: effective_seconds = start_at_frames / fps.

ALTER TABLE node_video_layers ADD COLUMN start_at_frames INTEGER;
ALTER TABLE node_audio_tracks ADD COLUMN start_at_frames INTEGER;
ALTER TABLE transition_video_layers ADD COLUMN start_at_frames INTEGER;
ALTER TABLE transition_audio_tracks ADD COLUMN start_at_frames INTEGER;
