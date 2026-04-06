package com.engine.editor.ffmpeg;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * {@link VideoProcessor} implementation backed by FFmpeg and FFprobe CLI tools.
 *
 * <p>All heavy lifting (process execution, timeout, stream draining) is
 * delegated to {@link ProcessRunner}.  Command construction is handled by
 * {@link FFmpegCommandBuilder}.</p>
 */
@Component
public class FFmpegVideoProcessor implements VideoProcessor {

    private static final Logger log = LoggerFactory.getLogger(FFmpegVideoProcessor.class);
    private static final int DEFAULT_TIMEOUT_SECONDS = 600;

    private String ffmpegPath = "ffmpeg";
    private String ffprobePath = "ffprobe";

    private final FFprobeMediaAnalyzer analyzer;

    public FFmpegVideoProcessor(FFprobeMediaAnalyzer analyzer) {
        this.analyzer = analyzer;
    }

    public void setFfmpegPath(String path) { this.ffmpegPath = path; }
    public void setFfprobePath(String path) {
        this.ffprobePath = path;
        this.analyzer.setFfprobePath(path);
    }

    // ── VideoProcessor interface ──────────────────────────────────────────────

    @Override
    public MediaInfo probe(Path filePath) throws IOException {
        return analyzer.analyze(filePath);
    }

    @Override
    public Path composite(CompositeSpec spec) throws IOException {
        Files.createDirectories(spec.getOutputPath().getParent());
        List<String> command = buildCompositeCommand(spec);
        ProcessResult result = ProcessRunner.run(command, DEFAULT_TIMEOUT_SECONDS);
        if (!result.isSuccess()) {
            throw new IOException("FFmpeg composite failed: " + result.getStderr());
        }
        return spec.getOutputPath();
    }

    /**
     * Like {@link #composite} but reports progress via a {@link PreviewJob}.
     * The caller passes the job; this method attaches/detaches the FFmpeg process
     * for cancellation support and updates progress via callbacks.
     */
    public Path compositeWithProgress(CompositeSpec spec,
                                      com.engine.editor.preview.PreviewJob job) throws IOException {
        Files.createDirectories(spec.getOutputPath().getParent());
        List<String> command = buildCompositeCommand(spec);

        ProgressProcessRunner.ProcessRef ref = new ProgressProcessRunner.ProcessRef();
        ProcessResult result = ProgressProcessRunner.run(
            command,
            DEFAULT_TIMEOUT_SECONDS,
            spec.getDuration(),
            (pct, text) -> job.setProgress(pct, text),
            job::isCancelRequested,
            ref
        );
        // After run returns, ref is cleared — attach/detach lifecycle handled inside runner
        if (job.isCancelRequested()) {
            throw new IOException("Cancelled");
        }
        if (!result.isSuccess()) {
            throw new IOException("FFmpeg composite failed: " + result.getStderr());
        }
        return spec.getOutputPath();
    }

    @Override
    public Path transcode(Path inputPath, Path outputPath, TranscodeOptions options) throws IOException {
        Files.createDirectories(outputPath.getParent());

        FFmpegCommandBuilder builder = FFmpegCommandBuilder.create()
            .ffmpegPath(ffmpegPath)
            .overwrite()
            .hideBanner()
            .logLevel("error")
            .input(inputPath.toAbsolutePath().toString())
            .videoCodec(options.getVideoCodec())
            .audioCodec(options.getAudioCodec())
            .videoBitRate(options.getVideoBitRateKbps())
            .audioBitRate(options.getAudioBitRateKbps())
            .audioSampleRate(options.getAudioSampleRate())
            .frameRate(options.getFps());

        if (options.getOutputResolution() != null) {
            builder.resolution(options.getOutputResolution());
        }

        builder.output(outputPath.toAbsolutePath().toString());

        ProcessResult result = ProcessRunner.run(builder.build(), DEFAULT_TIMEOUT_SECONDS);
        if (!result.isSuccess()) {
            throw new IOException("FFmpeg transcode failed: " + result.getStderr());
        }
        return outputPath;
    }

    @Override
    public void generateHls(Path inputPath, Path outputDir, HlsOptions options) throws IOException {
        Files.createDirectories(outputDir);

        String segmentPattern = outputDir.resolve("segment_%05d.ts").toAbsolutePath().toString();
        String playlistPath   = outputDir.resolve(options.getPlaylistName()).toAbsolutePath().toString();

        List<String> command = FFmpegCommandBuilder.create()
            .ffmpegPath(ffmpegPath)
            .overwrite()
            .hideBanner()
            .logLevel("error")
            .input(inputPath.toAbsolutePath().toString())
            .videoCodec("copy")
            .audioCodec("copy")
            .hlsSegmentDuration(options.getSegmentDurationSeconds())
            .hlsPlaylistType("vod")
            .hlsSegmentFilename(segmentPattern)
            .output(playlistPath)
            .build();

        ProcessResult result = ProcessRunner.run(command, DEFAULT_TIMEOUT_SECONDS);
        if (!result.isSuccess()) {
            throw new IOException("FFmpeg HLS generation failed: " + result.getStderr());
        }
        // FFmpeg writes TARGETDURATION as floor(max_segment_duration), which gives 0 for
        // clips shorter than 1 second. Fix it to ceil(max_extinf) per HLS spec (RFC 8216 §4.3.3.1).
        fixTargetDuration(outputDir.resolve(options.getPlaylistName()));
    }

    private static void fixTargetDuration(Path playlist) {
        if (!Files.exists(playlist)) return;
        try {
            String content = Files.readString(playlist);
            // Find the maximum EXTINF duration value
            double maxExtinf = 0;
            for (String line : content.split("\n")) {
                line = line.trim();
                if (line.startsWith("#EXTINF:")) {
                    try {
                        double d = Double.parseDouble(line.substring(8).replace(",", "").trim());
                        if (d > maxExtinf) maxExtinf = d;
                    } catch (NumberFormatException ignored) {}
                }
            }
            int correct = (int) Math.ceil(maxExtinf);
            if (correct < 1) correct = 1;
            String fixed = content.replaceFirst(
                "#EXT-X-TARGETDURATION:\\d+",
                "#EXT-X-TARGETDURATION:" + correct);
            if (!fixed.equals(content)) Files.writeString(playlist, fixed);
        } catch (IOException ignored) {}
    }

    @Override
    public boolean isAvailable() {
        try {
            ProcessResult ffmpegCheck = ProcessRunner.run(List.of(ffmpegPath, "-version"), 10);
            ProcessResult ffprobeCheck = ProcessRunner.run(List.of(ffprobePath, "-version"), 10);
            return ffmpegCheck.isSuccess() && ffprobeCheck.isSuccess();
        } catch (IOException e) {
            return false;
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private List<String> buildCompositeCommand(CompositeSpec spec) {
        FFmpegCommandBuilder builder = FFmpegCommandBuilder.create()
            .ffmpegPath(ffmpegPath)
            .overwrite()
            .hideBanner()
            .logLevel("error")
            .threads(spec.getFfmpegThreads());

        builder.colorInput(
            spec.getBackgroundColor(),
            spec.getOutputResolution(),
            spec.getFps(),
            spec.getDuration()
        );

        List<VideoLayerSpec> layers = spec.getVideoLayers();
        List<Integer> audioInputIndexes = new ArrayList<>();
        for (int i = 0; i < layers.size(); i++) {
            VideoLayerSpec layer = layers.get(i);
            List<String> preOpts = new ArrayList<>();
            if (layer.isLoopLayer()) {
                preOpts.add("-stream_loop");
                preOpts.add("-1");
            }
            if (layer.isHasAlpha() && "vp9".equalsIgnoreCase(layer.getCodec())) {
                preOpts.add("-vcodec");
                preOpts.add("libvpx-vp9");
            }
            if (layer.getStartAt() > 0) {
                preOpts.add("-itsoffset");
                preOpts.add(String.format("%.6f", layer.getStartAt()));
            }
            if (!preOpts.isEmpty()) {
                builder.inputWithOptions(preOpts, layer.getFilePath().toAbsolutePath().toString());
            } else {
                builder.input(layer.getFilePath().toAbsolutePath().toString());
            }
            if (inputHasAudio(layer.getFilePath())) {
                audioInputIndexes.add(i + 1);
            }
        }

        List<AudioTrackSpec> tracks = spec.getAudioTracks();
        for (int i = 0; i < tracks.size(); i++) {
            AudioTrackSpec track = tracks.get(i);
            if (track.getStartAt() > 0) {
                builder.inputWithOptions(
                    List.of("-itsoffset", String.format("%.6f", track.getStartAt())),
                    track.getFilePath().toAbsolutePath().toString()
                );
            } else {
                builder.input(track.getFilePath().toAbsolutePath().toString());
            }
            audioInputIndexes.add(layers.size() + i + 1);
        }

        String filterComplex = buildOverlayFilter(layers, audioInputIndexes, spec.getOutputResolution(), spec.getDuration());
        if (filterComplex != null) {
            builder.filterComplex(filterComplex);
            builder.mapVideo("[vout]");
        } else {
            builder.map("0:v");
        }

        if (!audioInputIndexes.isEmpty()) {
            builder.map("[aout]");
        }

        builder.videoCodec("libx264")
               .pixelFormat("yuv420p")
               .frameRate(spec.getFps())
               .audioCodec("aac")
               .duration(spec.getDuration())
               .output(spec.getOutputPath().toAbsolutePath().toString());

        return builder.build();
    }

    /**
     * Builds a {@code -filter_complex} expression that stacks video layers
     * on top of the background (input 0) via chained {@code overlay} filters,
     * and mixes audio tracks with {@code amix}.
     *
     * Returns {@code null} when there are no layers and no tracks (nothing to filter).
     */
    private String buildOverlayFilter(List<VideoLayerSpec> layers, List<Integer> audioInputIndexes,
                                      String outputResolution, double duration) {
        if (layers.isEmpty() && audioInputIndexes.isEmpty()) return null;

        List<String> parts = new ArrayList<>();
        String currentVideo = "[0:v]";
        String[] canvasSize = parseResolution(outputResolution);
        String canvasWidth = canvasSize != null ? canvasSize[0] : null;
        String canvasHeight = canvasSize != null ? canvasSize[1] : null;
        // input 0 is the background; layers start at input index 1
        for (int i = 0; i < layers.size(); i++) {
            int inputIdx = i + 1;
            String nextLabel = (i == layers.size() - 1) ? "[vout]" : "[ov" + i + "]";
            String eofAction = layers.get(i).isFreezeLastFrame() ? "repeat" : "pass";
            String overlayInput = "[" + inputIdx + ":v]";
            if (canvasWidth != null && canvasHeight != null) {
                String scaledLabel = "[vs" + i + "]";
                parts.add("[" + inputIdx + ":v]scale=w=" + canvasWidth + ":h=" + canvasHeight
                    + ":force_original_aspect_ratio=decrease,setsar=1" + scaledLabel);
                overlayInput = scaledLabel;
            }
            parts.add(currentVideo + overlayInput
                + "overlay=(W-w)/2:(H-h)/2:format=auto:eof_action=" + eofAction + nextLabel);
            currentVideo = nextLabel;
        }

        if (layers.isEmpty()) {
            // No video layers — just pass background through
            parts.add("[0:v]copy[vout]");
        }

        // Audio mixing — audio inputs follow video layer inputs
        if (!audioInputIndexes.isEmpty()) {
            StringBuilder amix = new StringBuilder();
            for (Integer inputIndex : audioInputIndexes) {
                amix.append("[").append(inputIndex).append(":a]");
            }
            amix.append("amix=inputs=").append(audioInputIndexes.size())
                .append(":normalize=0,atrim=0:")
                .append(String.format("%.6f", duration))
                .append("[aout]");
            parts.add(amix.toString());
        }

        return String.join(";", parts);
    }

    private boolean inputHasAudio(Path filePath) {
        try {
            return analyzer.analyze(filePath).isHasAudio();
        } catch (IOException e) {
            log.warn("Failed to detect embedded audio for {}: {}", filePath, e.getMessage());
            return false;
        }
    }

    private String[] parseResolution(String resolution) {
        if (resolution == null) return null;
        String[] parts = resolution.toLowerCase().split("x", 2);
        if (parts.length != 2) return null;
        String width = parts[0].trim();
        String height = parts[1].trim();
        if (width.isEmpty() || height.isEmpty()) return null;
        return new String[] { width, height };
    }
}
