package com.engine.editor.service;

import com.engine.editor.exception.ProjectException;
import com.engine.editor.ffmpeg.AudioTrackSpec;
import com.engine.editor.ffmpeg.CompositeSpec;
import com.engine.editor.ffmpeg.VideoLayerSpec;
import com.engine.editor.ffmpeg.FFmpegVideoProcessor;
import com.engine.editor.ffmpeg.VideoProcessor;
import com.engine.editor.model.ProjectConfigData;
import com.engine.editor.preview.PreviewJob;
import com.engine.editor.preview.PreviewJobStore;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class ScenePreviewService {

    private static final ExecutorService EXECUTOR =
        Executors.newFixedThreadPool(2, r -> { Thread t = new Thread(r, "preview-scene"); t.setDaemon(true); return t; });

    private final ProjectService        projectService;
    private final FFmpegVideoProcessor  videoProcessor;
    private final PreviewJobStore       jobStore;

    public ScenePreviewService(ProjectService projectService,
                               VideoProcessor videoProcessor,
                               PreviewJobStore jobStore) {
        this.projectService = projectService;
        this.videoProcessor = (FFmpegVideoProcessor) videoProcessor;
        this.jobStore       = jobStore;
    }

    public PreviewJob startPreview(String nodeId) {
        JdbcTemplate jdbc = projectService.requireJdbc();

        // Validate node exists and is a scene
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, type FROM nodes WHERE id=?", nodeId);
        if (rows.isEmpty()) throw new ProjectException("Node not found: " + nodeId);
        if (!"scene".equals(rows.get(0).get("type")))
            throw new ProjectException("Node is not a scene node: " + nodeId);

        String jobId = UUID.randomUUID().toString();
        PreviewJob job = new PreviewJob(jobId, nodeId, "scene");
        jobStore.put(job);

        EXECUTOR.submit(() -> runScenePreview(job));
        return job;
    }

    private void runScenePreview(PreviewJob job) {
        job.markRunning("Loading scene data…");
        try {
            if (job.isCancelRequested()) { job.markCancelled(); return; }
            JdbcTemplate jdbc = projectService.requireJdbc();
            ProjectConfigData config = projectService.getConfig();
            Path projectDir = projectService.getCurrentProjectPath();

            String nodeId = job.getSubjectId();

            // Load node background color
            String bgColor = jdbc.queryForObject(
                "SELECT COALESCE(background_color, '#000000') FROM nodes WHERE id=?",
                String.class, nodeId);
            // Normalize hex color for ffmpeg (remove #)
            String ffmpegBg = bgColor != null ? bgColor.replaceFirst("^#", "0x") : "0x000000";

            job.setProgress(5, "Loading layers…");
            // Load video layers
            List<Map<String, Object>> layerRows = jdbc.queryForList("""
                SELECT nvl.layer_order, nvl.start_at, a.file_path, a.duration, a.has_alpha
                FROM node_video_layers nvl
                JOIN assets a ON a.id = nvl.asset_id
                WHERE nvl.node_id = ? ORDER BY nvl.layer_order
                """, nodeId);

            // Load audio tracks
            List<Map<String, Object>> audioRows = jdbc.queryForList("""
                SELECT nat.track_order, nat.start_at, a.file_path, a.duration
                FROM node_audio_tracks nat
                JOIN assets a ON a.id = nat.asset_id
                WHERE nat.node_id = ? ORDER BY nat.track_order
                """, nodeId);

            // Compute duration
            double duration = computeDuration(layerRows, audioRows);
            if (duration <= 0) duration = 5.0; // default for empty scene

            job.setProgress(15, "Building composite spec…");
            if (job.isCancelRequested()) { job.markCancelled(); return; }

            // Build specs
            List<VideoLayerSpec> videoLayers = new ArrayList<>();
            for (int i = 0; i < layerRows.size(); i++) {
                Map<String, Object> row = layerRows.get(i);
                double startAt = toDouble(row.get("start_at"));
                videoLayers.add(new VideoLayerSpec(
                    Path.of((String) row.get("file_path")), startAt, i));
            }

            List<AudioTrackSpec> audioTracks = new ArrayList<>();
            for (int i = 0; i < audioRows.size(); i++) {
                Map<String, Object> row = audioRows.get(i);
                double startAt = toDouble(row.get("start_at"));
                audioTracks.add(new AudioTrackSpec(
                    Path.of((String) row.get("file_path")), startAt, i));
            }

            // Output path
            Path previewDir = projectDir.resolve("preview");
            Files.createDirectories(previewDir);
            Path outFile = previewDir.resolve("scene_" + job.getId() + ".mp4");

            String resolution = config.getPreviewResolution() != null
                ? config.getPreviewResolution() : "1280x720";
            int fps = config.getFps() > 0 ? config.getFps() : 30;

            CompositeSpec spec = CompositeSpec.builder()
                .videoLayers(videoLayers)
                .audioTracks(audioTracks)
                .backgroundColor(ffmpegBg)
                .outputResolution(resolution)
                .fps(fps)
                .duration(duration)
                .outputPath(outFile)
                .ffmpegThreads(config.getFfmpegThreads())
                .build();

            job.setProgress(25, "Starting FFmpeg…");
            videoProcessor.compositeWithProgress(spec, job);

            if (job.isCancelRequested()) { job.markCancelled(); return; }
            String relPath = "preview/scene_" + job.getId() + ".mp4";
            job.markDone(relPath);

        } catch (Exception e) {
            if (job.isCancelRequested()) { job.markCancelled(); return; }
            job.markFailed(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
        }
    }

    private double computeDuration(List<Map<String, Object>> layers, List<Map<String, Object>> audio) {
        double max = 0;
        for (Map<String, Object> row : layers) {
            Object dur = row.get("duration");
            if (dur != null) {
                max = Math.max(max, toDouble(dur) + toDouble(row.get("start_at")));
            }
        }
        for (Map<String, Object> row : audio) {
            Object dur = row.get("duration");
            if (dur != null) {
                max = Math.max(max, toDouble(dur) + toDouble(row.get("start_at")));
            }
        }
        return max;
    }

    private double toDouble(Object val) {
        if (val == null) return 0.0;
        if (val instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(val.toString()); } catch (Exception e) { return 0.0; }
    }
}
