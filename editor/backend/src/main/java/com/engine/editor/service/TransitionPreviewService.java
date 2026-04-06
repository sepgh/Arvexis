package com.engine.editor.service;

import com.engine.editor.exception.ProjectException;
import com.engine.editor.ffmpeg.*;
import com.engine.editor.model.ProjectConfigData;
import com.engine.editor.preview.PreviewJob;
import com.engine.editor.preview.PreviewJobStore;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class TransitionPreviewService {

    private static final ExecutorService EXECUTOR =
        Executors.newFixedThreadPool(2, r -> { Thread t = new Thread(r, "preview-trans"); t.setDaemon(true); return t; });

    // Map editor transition names -> FFmpeg xfade transition names
    private static final Map<String, String> XFADE_MAP = Map.of(
        "fade_in",    "fade",
        "fade_out",   "fade",
        "crossfade",  "fade",
        "slide_left", "slideleft",
        "slide_right","slideright",
        "wipe",       "wipeleft",
        "dissolve",   "dissolve"
    );

    private final ProjectService         projectService;
    private final FFmpegVideoProcessor   videoProcessor;
    private final PreviewJobStore        jobStore;

    public TransitionPreviewService(ProjectService projectService,
                                    VideoProcessor videoProcessor,
                                    PreviewJobStore jobStore) {
        this.projectService = projectService;
        this.videoProcessor = (FFmpegVideoProcessor) videoProcessor;
        this.jobStore       = jobStore;
    }

    public PreviewJob startPreview(String edgeId) {
        JdbcTemplate jdbc = projectService.requireJdbc();

        Integer c = jdbc.queryForObject("SELECT COUNT(*) FROM edges WHERE id=?", Integer.class, edgeId);
        if (c == null || c == 0) throw new ProjectException("Edge not found: " + edgeId);

        String jobId = UUID.randomUUID().toString();
        PreviewJob job = new PreviewJob(jobId, edgeId, "transition");
        jobStore.put(job);

        EXECUTOR.submit(() -> runTransitionPreview(job));
        return job;
    }

    private void runTransitionPreview(PreviewJob job) {
        job.markRunning("Loading transition data…");
        try {
            if (job.isCancelRequested()) { job.markCancelled(); return; }
            JdbcTemplate jdbc = projectService.requireJdbc();
            ProjectConfigData config = projectService.getConfig();
            Path projectDir = projectService.getCurrentProjectPath();

            String edgeId = job.getSubjectId();

            // Load transition info
            List<Map<String, Object>> transRows = jdbc.queryForList(
                "SELECT type, duration, background_color FROM edge_transitions WHERE edge_id=?", edgeId);

            String transType = transRows.isEmpty() ? "cut" : (String) transRows.get(0).get("type");
            Object durObj    = transRows.isEmpty() ? null  : transRows.get(0).get("duration");
            double transDur  = durObj instanceof Number n ? n.doubleValue() : 1.0;
            if (transDur <= 0) transDur = 1.0;
            String transBg   = transRows.isEmpty() ? null  : (String) transRows.get(0).get("background_color");

            String resolution = config.getPreviewResolution() != null
                ? config.getPreviewResolution() : "1280x720";
            int fps = config.getFps() > 0 ? config.getFps() : 30;

            Path previewDir = projectDir.resolve("preview");
            Files.createDirectories(previewDir);
            Path outFile = previewDir.resolve("trans_" + job.getId() + ".mp4");

            job.setProgress(15, "Building FFmpeg command…");
            if (job.isCancelRequested()) { job.markCancelled(); return; }

            Integer threads = config.getFfmpegThreads();
            if ("video".equals(transType)) {
                compileVideoTransition(edgeId, jdbc, config, transBg, resolution, fps, threads, outFile, transDur, job);
            } else if ("cut".equals(transType) || !XFADE_MAP.containsKey(transType)) {
                compileCutTransition(resolution, fps, threads, outFile, job);
            } else {
                compileBuiltinTransition(transType, transDur, resolution, fps, threads, outFile, job);
            }

            if (job.isCancelRequested()) { job.markCancelled(); return; }
            job.markDone("preview/trans_" + job.getId() + ".mp4");

        } catch (Exception e) {
            if (job.isCancelRequested()) { job.markCancelled(); return; }
            job.markFailed(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
        }
    }

    // ── Built-in: xfade between two solid-color frames ────────────────────────

    private void compileBuiltinTransition(String transType, double transDur,
                                          String resolution, int fps, Integer ffmpegThreads,
                                          Path outFile, PreviewJob job) throws Exception {
        String xfadeEffect = XFADE_MAP.get(transType);
        double padDur   = 1.0;
        double totalDur = padDur + transDur + padDur;
        double offset   = padDur;

        String srcA = String.format("color=c=0x3b82f6:s=%s:r=%d:d=%.3f", resolution, fps, totalDur);
        String srcB = String.format("color=c=0xf59e0b:s=%s:r=%d:d=%.3f", resolution, fps, totalDur);
        String filter = String.format(
            "[0:v][1:v]xfade=transition=%s:duration=%.3f:offset=%.3f[vout]",
            xfadeEffect, transDur, offset);

        List<String> cmd = FFmpegCommandBuilder.create()
            .overwrite().hideBanner().logLevel("error").threads(ffmpegThreads)
            .inputWithOptions(List.of("-f", "lavfi"), srcA)
            .inputWithOptions(List.of("-f", "lavfi"), srcB)
            .filterComplex(filter).mapVideo("[vout]")
            .videoCodec("libx264").pixelFormat("yuv420p").frameRate(fps)
            .output(outFile.toAbsolutePath().toString()).build();

        job.setProgress(25, "Starting FFmpeg…");
        ProcessResult result = ProgressProcessRunner.run(cmd, 120, totalDur,
            (pct, text) -> job.setProgress(pct, text),
            job::isCancelRequested, new ProgressProcessRunner.ProcessRef());
        if (job.isCancelRequested()) throw new Exception("Cancelled");
        if (!result.isSuccess()) throw new Exception("FFmpeg xfade failed: " + result.getStderr());
    }

    // ── Cut: 1s color A, hard cut to 1s color B ───────────────────────────────

    private void compileCutTransition(String resolution, int fps, Integer ffmpegThreads,
                                       Path outFile, PreviewJob job) throws Exception {
        String srcA = String.format("color=c=0x3b82f6:s=%s:r=%d:d=1.0", resolution, fps);
        String srcB = String.format("color=c=0xf59e0b:s=%s:r=%d:d=1.0", resolution, fps);

        List<String> cmd = FFmpegCommandBuilder.create()
            .overwrite().hideBanner().logLevel("error").threads(ffmpegThreads)
            .inputWithOptions(List.of("-f", "lavfi"), srcA)
            .inputWithOptions(List.of("-f", "lavfi"), srcB)
            .filterComplex("[0:v][1:v]concat=n=2:v=1:a=0[vout]").mapVideo("[vout]")
            .videoCodec("libx264").pixelFormat("yuv420p").frameRate(fps)
            .output(outFile.toAbsolutePath().toString()).build();

        job.setProgress(25, "Starting FFmpeg…");
        ProcessResult result = ProgressProcessRunner.run(cmd, 120, 2.0,
            (pct, text) -> job.setProgress(pct, text),
            job::isCancelRequested, new ProgressProcessRunner.ProcessRef());
        if (job.isCancelRequested()) throw new Exception("Cancelled");
        if (!result.isSuccess()) throw new Exception("FFmpeg cut preview failed: " + result.getStderr());
    }

    // ── Video-based: composite layers same as scene preview ───────────────────

    private void compileVideoTransition(String edgeId, JdbcTemplate jdbc,
                                        ProjectConfigData config, String transitionBg,
                                        String resolution, int fps, Integer ffmpegThreads,
                                        Path outFile, double fallbackDur,
                                        PreviewJob job) throws Exception {
        List<Map<String, Object>> layerRows = jdbc.queryForList("""
            SELECT tvl.layer_order, tvl.start_at, tvl.start_at_frames, tvl.freeze_last_frame, a.file_path, a.duration, a.has_alpha, a.codec
            FROM transition_video_layers tvl
            JOIN assets a ON a.id = tvl.asset_id
            WHERE tvl.edge_id = ? ORDER BY tvl.layer_order
            """, edgeId);

        List<Map<String, Object>> audioRows = jdbc.queryForList("""
            SELECT tat.track_order, tat.start_at, tat.start_at_frames, a.file_path, a.duration
            FROM transition_audio_tracks tat
            JOIN assets a ON a.id = tat.asset_id
            WHERE tat.edge_id = ? ORDER BY tat.track_order
            """, edgeId);

        List<VideoLayerSpec> videoLayers = new ArrayList<>();
        for (int i = 0; i < layerRows.size(); i++) {
            Map<String, Object> row = layerRows.get(i);
            boolean hasAlpha = row.get("has_alpha") instanceof Number n ? n.intValue() == 1 : Boolean.TRUE.equals(row.get("has_alpha"));
            boolean freeze   = row.get("freeze_last_frame") instanceof Number n ? n.intValue() == 1 : Boolean.TRUE.equals(row.get("freeze_last_frame"));
            String codec = row.get("codec") instanceof String s ? s : null;
            videoLayers.add(new VideoLayerSpec(
                Path.of((String) row.get("file_path")), resolveStartAt(row.get("start_at"), row.get("start_at_frames"), fps), i, hasAlpha, freeze, codec));
        }

        List<AudioTrackSpec> audioTracks = new ArrayList<>();
        for (int i = 0; i < audioRows.size(); i++) {
            Map<String, Object> row = audioRows.get(i);
            audioTracks.add(new AudioTrackSpec(
                Path.of((String) row.get("file_path")), resolveStartAt(row.get("start_at"), row.get("start_at_frames"), fps), i));
        }

        double duration = fallbackDur > 0 ? fallbackDur : computeDuration(layerRows, audioRows, fps);
        if (duration <= 0) duration = computeDuration(layerRows, audioRows, fps);
        if (duration <= 0) duration = 1.0;

        String bgHex = transitionBg != null && !transitionBg.isBlank() ? transitionBg
                     : config.getDefaultBackgroundColor() != null ? config.getDefaultBackgroundColor()
                     : "#ffffff";
        String ffmpegBg = bgHex.replaceFirst("^#", "0x");

        CompositeSpec spec = CompositeSpec.builder()
            .videoLayers(videoLayers)
            .audioTracks(audioTracks)
            .backgroundColor(ffmpegBg)
            .outputResolution(resolution)
            .fps(fps)
            .duration(duration)
            .outputPath(outFile)
            .ffmpegThreads(ffmpegThreads)
            .build();

        job.setProgress(25, "Starting FFmpeg…");
        videoProcessor.compositeWithProgress(spec, job);
    }

    private double computeDuration(List<Map<String, Object>> layers, List<Map<String, Object>> audio, int fps) {
        double max = 0;
        for (Map<String, Object> row : layers) {
            Object dur = row.get("duration");
            if (dur != null) max = Math.max(max, toDouble(dur) + resolveStartAt(row.get("start_at"), row.get("start_at_frames"), fps));
        }
        for (Map<String, Object> row : audio) {
            Object dur = row.get("duration");
            if (dur != null) max = Math.max(max, toDouble(dur) + resolveStartAt(row.get("start_at"), row.get("start_at_frames"), fps));
        }
        return max;
    }

    private double resolveStartAt(Object startAtSeconds, Object startAtFrames, int fps) {
        if (startAtFrames instanceof Number n && n.intValue() >= 0) {
            return n.intValue() / (double) fps;
        }
        return toDouble(startAtSeconds);
    }

    private double toDouble(Object val) {
        if (val == null) return 0.0;
        if (val instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(val.toString()); } catch (Exception e) { return 0.0; }
    }
}
