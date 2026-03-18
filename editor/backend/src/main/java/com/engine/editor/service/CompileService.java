package com.engine.editor.service;

import com.engine.editor.ffmpeg.*;
import com.engine.editor.model.ProjectConfigData;
import com.engine.editor.preview.PreviewJob;
import com.engine.editor.preview.PreviewJobStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermission;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;
import java.util.zip.*;

@Service
public class CompileService {

    private static final ExecutorService EXECUTOR =
        Executors.newSingleThreadExecutor(r -> { Thread t = new Thread(r, "compile-main"); t.setDaemon(true); return t; });

    // Named bandwidth (kbps) estimates per resolution for master playlist
    private static final Map<String, Integer> RESOLUTION_BANDWIDTH = Map.of(
        "3840x2160", 15_000, "2560x1440", 8_000, "1920x1080", 4_000,
        "1280x720",  2_500,  "854x480",   1_200, "640x360",   600
    );

    private static final Map<String, String> XFADE_MAP = Map.of(
        "fade_in",    "fade",
        "fade_out",   "fade",
        "crossfade",  "fade",
        "slide_left", "slideleft",
        "slide_right","slideright",
        "wipe",       "wipeleft",
        "dissolve",   "dissolve"
    );

    private final ManifestService      manifestService;
    private final ProjectService       projectService;
    private final FFmpegVideoProcessor videoProcessor;
    private final PreviewJobStore      jobStore;
    private final ObjectMapper         mapper = new ObjectMapper();

    private volatile Path lastZipPath;

    public CompileService(ManifestService manifestService,
                          ProjectService projectService,
                          VideoProcessor videoProcessor,
                          PreviewJobStore jobStore) {
        this.manifestService = manifestService;
        this.projectService  = projectService;
        this.videoProcessor  = (FFmpegVideoProcessor) videoProcessor;
        this.jobStore        = jobStore;
    }

    // ── Public ────────────────────────────────────────────────────────────────

    public Path getLastZipPath() { return lastZipPath; }

    public PreviewJob startCompilation() {
        String jobId = UUID.randomUUID().toString();
        PreviewJob job = new PreviewJob(jobId, "project", "compile");
        jobStore.put(job);
        EXECUTOR.submit(() -> runCompilation(job));
        return job;
    }

    // ── Main compile loop ─────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private void runCompilation(PreviewJob job) {
        job.markRunning("Reading manifest…");
        try {
            // Ensure manifest exists (auto-regenerate)
            manifestService.generateManifest();
            Path manifestFile = manifestService.requireManifestFile();
            Map<String, Object> manifest = mapper.readValue(manifestFile.toFile(), Map.class);

            ProjectConfigData config = projectService.getConfig();
            Path projectDir = projectService.getCurrentProjectPath();
            Path outputBase = projectDir.resolve("output");
            Files.createDirectories(outputBase);

            String rootId = (String) manifest.get("rootNodeId");
            if (rootId == null) throw new RuntimeException("No root node in manifest");

            List<Map<String, Object>> nodes = (List<Map<String, Object>>) manifest.get("nodes");
            List<Map<String, Object>> edges = (List<Map<String, Object>>) manifest.get("edges");

            List<String> resolutions = resolveResolutions(config);
            int fps = config.getFps() > 0 ? config.getFps() : 30;

            List<Map<String, Object>> sceneNodes = nodes.stream()
                .filter(n -> "scene".equals(n.get("type"))).toList();
            List<Map<String, Object>> edgesWithTrans = edges.stream()
                .filter(e -> e.get("transition") != null).toList();

            int totalItems = (sceneNodes.size() + edgesWithTrans.size()) * resolutions.size();
            int[] doneItems = {0};

            // ── Stage 1: Compile scenes at all resolutions (5→55%) ──────────
            // Track compiled scene paths keyed by sceneId+resolution for transition use
            Map<String, Path> compiledScenes = new HashMap<>();

            for (Map<String, Object> node : sceneNodes) {
                if (job.isCancelRequested()) { job.markCancelled(); return; }
                String sceneId = (String) node.get("id");
                String sceneName = (String) node.get("name");

                for (String res : resolutions) {
                    if (job.isCancelRequested()) { job.markCancelled(); return; }

                    String wh = resolveResolution(res);
                    Path outDir = outputBase.resolve(sceneId).resolve(res);
                    Files.createDirectories(outDir);
                    Path outFile = outDir.resolve("scene.mp4");

                    job.setProgress(pct(doneItems[0], totalItems, 5, 55),
                        "Compiling scene \"" + sceneName + "\" at " + res + "…");

                    compileScene(node, wh, fps, config.getFfmpegThreads(), outFile, job);
                    compiledScenes.put(sceneId + "@" + res, outFile);
                    doneItems[0]++;
                }
            }

            // ── Stage 2: Compile transitions at all resolutions (55→72%) ────
            for (Map<String, Object> edge : edgesWithTrans) {
                if (job.isCancelRequested()) { job.markCancelled(); return; }
                String edgeId = (String) edge.get("id");
                Map<String, Object> trans = (Map<String, Object>) edge.get("transition");
                String transType = (String) trans.get("type");
                double transDur = toDouble(trans.get("duration"));
                if (transDur <= 0) transDur = 1.0;

                for (String res : resolutions) {
                    if (job.isCancelRequested()) { job.markCancelled(); return; }
                    String wh = resolveResolution(res);
                    Path outDir = outputBase.resolve("trans_" + edgeId).resolve(res);
                    Files.createDirectories(outDir);
                    Path outFile = outDir.resolve("transition.mp4");

                    job.setProgress(pct(doneItems[0], totalItems, 55, 72),
                        "Compiling transition [" + transType + "] at " + res + "…");

                    if ("video".equals(transType)) {
                        compileVideoTransition(trans, fps, wh, config.getFfmpegThreads(), outFile, job);
                    } else {
                        String srcSceneId = (String) edge.get("sourceNodeId");
                        String tgtSceneId = (String) edge.get("targetNodeId");
                        Path srcVideo = compiledScenes.get(srcSceneId + "@" + res);
                        Path tgtVideo = compiledScenes.get(tgtSceneId + "@" + res);
                        compileBuiltinTransition(transType, transDur, wh, fps,
                            config.getFfmpegThreads(), srcVideo, tgtVideo, outFile, job);
                    }
                    doneItems[0]++;
                }
            }

            // ── Stage 3: HLS conversion (72→88%) ────────────────────────────
            int hlsTotal = (sceneNodes.size() + edgesWithTrans.size()) * resolutions.size();
            int[] hlsDone = {0};

            for (Map<String, Object> node : sceneNodes) {
                String sceneId = (String) node.get("id");
                double dur = toDouble(node.get("computedDuration"));
                if (dur <= 0) dur = 5.0;
                for (String res : resolutions) {
                    if (job.isCancelRequested()) { job.markCancelled(); return; }
                    Path mp4 = outputBase.resolve(sceneId).resolve(res).resolve("scene.mp4");
                    Path hlsDir = outputBase.resolve(sceneId).resolve(res);
                    job.setProgress(pct(hlsDone[0], hlsTotal, 72, 88),
                        "HLS: scene at " + res + "…");
                    if (Files.exists(mp4)) generateHls(mp4, hlsDir, fps, dur);
                    hlsDone[0]++;
                }
            }

            for (Map<String, Object> edge : edgesWithTrans) {
                String edgeId = (String) edge.get("id");
                Map<String, Object> trans = (Map<String, Object>) edge.get("transition");
                double dur = toDouble(trans.get("duration"));
                if (dur <= 0) dur = 1.0;
                for (String res : resolutions) {
                    if (job.isCancelRequested()) { job.markCancelled(); return; }
                    Path mp4 = outputBase.resolve("trans_" + edgeId).resolve(res).resolve("transition.mp4");
                    Path hlsDir = outputBase.resolve("trans_" + edgeId).resolve(res);
                    job.setProgress(pct(hlsDone[0], hlsTotal, 72, 88),
                        "HLS: transition at " + res + "…");
                    if (Files.exists(mp4)) generateHls(mp4, hlsDir, fps, dur);
                    hlsDone[0]++;
                }
            }

            // ── Stage 4: Master playlists (88→92%) ─────────────────────────
            job.setProgress(88, "Generating master playlists…");
            for (Map<String, Object> node : sceneNodes) {
                writeMasterPlaylist(outputBase.resolve((String) node.get("id")), resolutions);
            }
            for (Map<String, Object> edge : edgesWithTrans) {
                writeMasterPlaylist(outputBase.resolve("trans_" + edge.get("id")), resolutions);
            }

            // ── Stage 5: Package dist/ + create ZIP (92→100%) ──────────────
            if (job.isCancelRequested()) { job.markCancelled(); return; }
            Path zipPath = buildPackage(job, projectDir, outputBase, manifestFile);

            lastZipPath = zipPath;
            job.markDone(zipPath.toAbsolutePath().toString());

        } catch (Exception e) {
            if (job.isCancelRequested()) { job.markCancelled(); return; }
            job.markFailed(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
        }
    }

    // ── Packaging ─────────────────────────────────────────────────────────────

    private Path buildPackage(PreviewJob job, Path projectDir, Path outputBase,
                               Path manifestFile) throws Exception {
        Path distDir = projectDir.resolve("dist");
        Files.createDirectories(distDir);

        // manifest.json
        job.setProgress(92, "Packaging: copying manifest…");
        Files.copy(manifestFile, distDir.resolve("manifest.json"),
            StandardCopyOption.REPLACE_EXISTING);

        // runtime.jar from classpath resource
        job.setProgress(93, "Packaging: extracting runtime…");
        try (InputStream in = getClass().getResourceAsStream("/bundled/runtime.jar")) {
            if (in != null) {
                Files.copy(in, distDir.resolve("runtime.jar"), StandardCopyOption.REPLACE_EXISTING);
            } else {
                System.err.println("[CompileService] /bundled/runtime.jar not found in classpath");
            }
        }

        // start.sh
        job.setProgress(94, "Packaging: writing startup scripts…");
        Path startSh = distDir.resolve("start.sh");
        Files.writeString(startSh,
            "#!/bin/sh\n" +
            "# Arvexis — Runtime\n" +
            "# Usage: ./start.sh [--port 8090]\n" +
            "java -jar runtime.jar \"$@\"\n",
            StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        try {
            Set<PosixFilePermission> perms = new HashSet<>(
                Files.getPosixFilePermissions(startSh));
            perms.add(PosixFilePermission.OWNER_EXECUTE);
            perms.add(PosixFilePermission.GROUP_EXECUTE);
            Files.setPosixFilePermissions(startSh, perms);
        } catch (UnsupportedOperationException ignored) {}

        // start.bat
        Files.writeString(distDir.resolve("start.bat"),
            "@echo off\r\n" +
            "REM Arvexis — Runtime\r\n" +
            "java -jar runtime.jar %*\r\n",
            StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        // README.md
        job.setProgress(95, "Packaging: writing README…");
        String projectName = projectDir.getFileName().toString();
        Files.writeString(distDir.resolve("README.md"),
            buildReadme(projectName),
            StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        // Create dist.zip
        job.setProgress(97, "Packaging: creating ZIP archive…");
        Path zipFile = projectDir.resolve("dist.zip");
        createZip(distDir, outputBase, zipFile);

        job.setProgress(100, "Package ready.");
        return zipFile;
    }

    private String buildReadme(String projectName) {
        return "# " + projectName + " — Interactive Video\n\n" +
               "## Running Locally (Offline)\n\n" +
               "**Requirements**: Java 17 or newer\n\n" +
               "1. Unzip this archive\n" +
               "2. Open a terminal in the unzipped folder\n" +
               "3. Run `./start.sh` (Linux/Mac) or `start.bat` (Windows)\n" +
               "4. Open your browser at **http://localhost:8090/**\n\n" +
               "To use a different port: `./start.sh --port 9000`\n\n" +
               "## Running Online (Self-Hosted)\n\n" +
               "1. Copy the unzipped folder to your server\n" +
               "2. Run `java -jar runtime.jar --port 80` (or behind a reverse proxy on port 80/443)\n" +
               "3. Point your domain or IP at the server\n\n" +
               "For HTTPS, use a reverse proxy such as nginx or Caddy in front of the runtime.\n\n" +
               "### nginx example (reverse proxy to port 8090)\n\n" +
               "```nginx\n" +
               "location / {\n" +
               "    proxy_pass http://127.0.0.1:8090;\n" +
               "    proxy_http_version 1.1;\n" +
               "}\n" +
               "```\n\n" +
               "## Game State\n\n" +
               "Game progress is saved in `game-state.json` next to the manifest.  " +
               "Delete it to reset to the beginning.\n";
    }

    private void createZip(Path distDir, Path outputBase, Path zipFile) throws IOException {
        try (ZipOutputStream zos = new ZipOutputStream(
                Files.newOutputStream(zipFile,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING))) {

            // Add dist/ contents (manifest, runtime.jar, scripts, README)
            try (var walk = Files.walk(distDir)) {
                walk.filter(Files::isRegularFile).forEach(p -> {
                    String name = "game/" + distDir.relativize(p).toString();
                    try {
                        zos.putNextEntry(new ZipEntry(name));
                        Files.copy(p, zos);
                        zos.closeEntry();
                    } catch (IOException e) { throw new RuntimeException(e); }
                });
            }

            // Add output/ (compiled HLS) under game/output/
            if (Files.isDirectory(outputBase)) {
                try (var walk = Files.walk(outputBase)) {
                    walk.filter(Files::isRegularFile).forEach(p -> {
                        String name = "game/output/" + outputBase.relativize(p).toString();
                        try {
                            zos.putNextEntry(new ZipEntry(name));
                            Files.copy(p, zos);
                            zos.closeEntry();
                        } catch (IOException e) { throw new RuntimeException(e); }
                    });
                }
            }
        }
    }

    // ── Scene compilation ─────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private void compileScene(Map<String, Object> node, String resolution, int fps,
                               Integer ffmpegThreads, Path outFile, PreviewJob job) throws Exception {
        List<Map<String, Object>> layerData  = (List<Map<String, Object>>) node.getOrDefault("videoLayers", List.of());
        List<Map<String, Object>> audioData  = (List<Map<String, Object>>) node.getOrDefault("audioTracks", List.of());
        String bgHex = (String) node.getOrDefault("backgroundColor", "#000000");
        String ffmpegBg = bgHex.replaceFirst("^#", "0x");

        List<VideoLayerSpec> layers = new ArrayList<>();
        for (int i = 0; i < layerData.size(); i++) {
            Map<String, Object> r = layerData.get(i);
            String filePath = absPath((String) r.get("assetRelPath"), r);
            if (filePath == null) continue;
            boolean hasAlpha = r.get("hasAlpha") instanceof Boolean b ? b : Boolean.TRUE.equals(r.get("hasAlpha"));
            boolean freeze   = r.get("freezeLastFrame") instanceof Boolean b ? b : Boolean.TRUE.equals(r.get("freezeLastFrame"));
            layers.add(new VideoLayerSpec(Path.of(filePath), toDouble(r.get("startAt")), i, hasAlpha, freeze));
        }

        List<AudioTrackSpec> tracks = new ArrayList<>();
        for (int i = 0; i < audioData.size(); i++) {
            Map<String, Object> r = audioData.get(i);
            String filePath = absPath((String) r.get("assetRelPath"), r);
            if (filePath == null) continue;
            tracks.add(new AudioTrackSpec(Path.of(filePath), toDouble(r.get("startAt")), i));
        }

        double duration = toDouble(node.get("computedDuration"));
        if (duration <= 0) duration = 5.0;

        CompositeSpec spec = CompositeSpec.builder()
            .videoLayers(layers)
            .audioTracks(tracks)
            .backgroundColor(ffmpegBg)
            .outputResolution(resolution)
            .fps(fps)
            .duration(duration)
            .outputPath(outFile)
            .ffmpegThreads(ffmpegThreads)
            .build();

        videoProcessor.compositeWithProgress(spec, job);
    }

    // ── Built-in transition compilation using actual scene frames ─────────────

    private void compileBuiltinTransition(String transType, double transDur,
                                          String resolution, int fps,
                                          Integer ffmpegThreads,
                                          Path srcVideo, Path tgtVideo,
                                          Path outFile, PreviewJob job) throws Exception {
        String xfadeEffect = XFADE_MAP.getOrDefault(transType, "fade");
        boolean useLavfi = (srcVideo == null || !Files.exists(srcVideo) ||
                            tgtVideo == null || !Files.exists(tgtVideo));

        if (useLavfi) {
            // Fallback: color blocks (same as preview)
            double padDur = 1.0;
            double totalDur = padDur + transDur + padDur;
            String srcA = String.format("color=c=0x3b82f6:s=%s:r=%d:d=%.3f", resolution, fps, totalDur);
            String srcB = String.format("color=c=0xf59e0b:s=%s:r=%d:d=%.3f", resolution, fps, totalDur);
            String filter = String.format("[0:v][1:v]xfade=transition=%s:duration=%.3f:offset=%.3f[vout]",
                xfadeEffect, transDur, padDur);
            List<String> cmd = FFmpegCommandBuilder.create()
                .overwrite().hideBanner().logLevel("error").threads(ffmpegThreads)
                .inputWithOptions(List.of("-f", "lavfi"), srcA)
                .inputWithOptions(List.of("-f", "lavfi"), srcB)
                .filterComplex(filter).mapVideo("[vout]")
                .videoCodec("libx264").pixelFormat("yuv420p").frameRate(fps)
                .output(outFile.toAbsolutePath().toString()).build();
            runWithProgress(cmd, totalDur, outFile, job);
        } else if ("cut".equals(transType) || "none".equals(transType)) {
            // Hard cut: just copy 1s from end of A and start of B
            String filter = "[0:v][1:v]concat=n=2:v=1[vout]";
            List<String> cmd = FFmpegCommandBuilder.create()
                .overwrite().hideBanner().logLevel("error").threads(ffmpegThreads)
                .inputWithOptions(List.of("-sseof", String.format("-%.3f", Math.min(1.0, transDur))),
                    srcVideo.toAbsolutePath().toString())
                .inputWithOptions(List.of("-ss", "0", "-t", String.format("%.3f", Math.min(1.0, transDur))),
                    tgtVideo.toAbsolutePath().toString())
                .filterComplex(filter).mapVideo("[vout]")
                .videoCodec("libx264").pixelFormat("yuv420p").frameRate(fps)
                .output(outFile.toAbsolutePath().toString()).build();
            runWithProgress(cmd, transDur * 2, outFile, job);
        } else {
            // xfade using real scene content
            // Take last transDur secs of srcVideo and first transDur secs of tgtVideo
            String filter = String.format("[0:v][1:v]xfade=transition=%s:duration=%.3f:offset=0[vout]",
                xfadeEffect, transDur);
            List<String> cmd = FFmpegCommandBuilder.create()
                .overwrite().hideBanner().logLevel("error").threads(ffmpegThreads)
                .inputWithOptions(List.of("-sseof", String.format("-%.3f", transDur)),
                    srcVideo.toAbsolutePath().toString())
                .inputWithOptions(List.of("-ss", "0", "-t", String.format("%.3f", transDur)),
                    tgtVideo.toAbsolutePath().toString())
                .filterComplex(filter).mapVideo("[vout]")
                .videoCodec("libx264").pixelFormat("yuv420p").frameRate(fps)
                .output(outFile.toAbsolutePath().toString()).build();
            runWithProgress(cmd, transDur, outFile, job);
        }
    }

    // ── Video-based transition ────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private void compileVideoTransition(Map<String, Object> trans, int fps,
                                         String resolution, Integer ffmpegThreads,
                                         Path outFile, PreviewJob job) throws Exception {
        List<Map<String, Object>> layerData = (List<Map<String, Object>>) trans.getOrDefault("videoLayers", List.of());
        List<Map<String, Object>> audioData = (List<Map<String, Object>>) trans.getOrDefault("audioTracks", List.of());

        List<VideoLayerSpec> layers = new ArrayList<>();
        for (int i = 0; i < layerData.size(); i++) {
            Map<String, Object> r = layerData.get(i);
            String fp = absPath((String) r.get("assetRelPath"), r);
            if (fp == null) continue;
            boolean hasAlpha = r.get("hasAlpha") instanceof Boolean b ? b : Boolean.TRUE.equals(r.get("hasAlpha"));
            boolean freeze   = r.get("freezeLastFrame") instanceof Boolean b ? b : Boolean.TRUE.equals(r.get("freezeLastFrame"));
            layers.add(new VideoLayerSpec(Path.of(fp), toDouble(r.get("startAt")), i, hasAlpha, freeze));
        }
        List<AudioTrackSpec> tracks = new ArrayList<>();
        for (int i = 0; i < audioData.size(); i++) {
            Map<String, Object> r = audioData.get(i);
            String fp = absPath((String) r.get("assetRelPath"), r);
            if (fp != null) tracks.add(new AudioTrackSpec(Path.of(fp), toDouble(r.get("startAt")), i));
        }

        double duration = toDouble(trans.get("duration"));
        if (duration <= 0) duration = 2.0;

        CompositeSpec spec = CompositeSpec.builder()
            .videoLayers(layers).audioTracks(tracks)
            .backgroundColor("0x000000")
            .outputResolution(resolution).fps(fps).duration(duration)
            .outputPath(outFile)
            .ffmpegThreads(ffmpegThreads)
            .build();

        videoProcessor.compositeWithProgress(spec, job);
    }

    // ── HLS conversion ────────────────────────────────────────────────────────

    private void generateHls(Path mp4, Path outputDir, int fps, double duration) throws IOException {
        // Segment duration: fit ~6s, but cap at 10s; short clips use single segment
        int segSecs = duration <= 6.0 ? (int) Math.ceil(duration) : 6;
        HlsOptions opts = HlsOptions.builder()
            .segmentDurationSeconds(segSecs)
            .playlistName("playlist.m3u8")
            .build();
        videoProcessor.generateHls(mp4, outputDir, opts);
    }

    // ── Master variant playlist ───────────────────────────────────────────────

    private void writeMasterPlaylist(Path itemDir, List<String> resolutions) throws IOException {
        StringBuilder sb = new StringBuilder("#EXTM3U\n");
        for (String res : resolutions) {
            String wh = resolveResolution(res);
            int bw = RESOLUTION_BANDWIDTH.getOrDefault(wh, 2_000) * 1000; // bits/s
            sb.append("#EXT-X-STREAM-INF:BANDWIDTH=").append(bw)
              .append(",RESOLUTION=").append(wh).append('\n')
              .append(res).append("/playlist.m3u8\n");
        }
        Path masterFile = itemDir.resolve("master.m3u8");
        Files.writeString(masterFile, sb.toString(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void runWithProgress(List<String> cmd, double duration, Path outFile,
                                  PreviewJob job) throws Exception {
        Files.createDirectories(outFile.getParent());
        ProcessResult result = ProgressProcessRunner.run(cmd, 300, duration,
            (pct, text) -> {}, // progress already managed by caller
            job::isCancelRequested,
            new ProgressProcessRunner.ProcessRef());
        if (job.isCancelRequested()) throw new Exception("Cancelled");
        if (!result.isSuccess()) throw new Exception("FFmpeg failed: " + result.getStderr());
    }

    private List<String> resolveResolutions(ProjectConfigData config) {
        List<String> res = config.getCompileResolutions();
        if (res == null || res.isEmpty()) return List.of("720p");
        return res;
    }

    private String resolveResolution(String name) {
        return switch (name.toLowerCase()) {
            case "4k", "2160p"  -> "3840x2160";
            case "2k", "1440p"  -> "2560x1440";
            case "1080p"        -> "1920x1080";
            case "720p"         -> "1280x720";
            case "480p"         -> "854x480";
            case "360p"         -> "640x360";
            default             -> name; // pass WxH through
        };
    }

    private String absPath(String relPath, Map<String, Object> row) {
        // Manifest stores assetRelPath; resolve against assetsDirectory via config
        if (relPath == null) return null;
        try {
            ProjectConfigData config = projectService.getConfig();
            Path full = Path.of(config.getAssetsDirectory()).resolve(relPath).normalize();
            if (Files.exists(full)) return full.toString();
        } catch (Exception ignored) {}
        // Fallback: manifest also has assetRelPath stored; try resolving against project dir
        return null;
    }

    private int pct(int done, int total, int from, int to) {
        if (total <= 0) return from;
        return from + (int) ((double) done / total * (to - from));
    }

    private double toDouble(Object val) {
        if (val == null) return 0;
        if (val instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(val.toString()); } catch (Exception e) { return 0; }
    }
}
