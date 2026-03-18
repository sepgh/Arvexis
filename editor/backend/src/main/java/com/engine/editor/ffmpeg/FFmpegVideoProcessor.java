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
        for (VideoLayerSpec layer : layers) {
            if (layer.getStartAt() > 0) {
                builder.inputWithOptions(
                    List.of("-itsoffset", String.format("%.6f", layer.getStartAt())),
                    layer.getFilePath().toAbsolutePath().toString()
                );
            } else {
                builder.input(layer.getFilePath().toAbsolutePath().toString());
            }
        }

        List<AudioTrackSpec> tracks = spec.getAudioTracks();
        for (AudioTrackSpec track : tracks) {
            if (track.getStartAt() > 0) {
                builder.inputWithOptions(
                    List.of("-itsoffset", String.format("%.6f", track.getStartAt())),
                    track.getFilePath().toAbsolutePath().toString()
                );
            } else {
                builder.input(track.getFilePath().toAbsolutePath().toString());
            }
        }

        String filterComplex = buildOverlayFilter(layers, tracks);
        if (filterComplex != null) {
            builder.filterComplex(filterComplex);
            builder.mapVideo("[vout]");
        } else {
            builder.map("0:v");
        }

        if (!tracks.isEmpty()) {
            builder.map("[aout]");
        }

        builder.videoCodec("libx264")
               .pixelFormat("yuv420p")
               .frameRate(spec.getFps())
               .audioCodec("aac")
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
    private String buildOverlayFilter(List<VideoLayerSpec> layers, List<AudioTrackSpec> tracks) {
        if (layers.isEmpty() && tracks.isEmpty()) return null;

        List<String> parts = new ArrayList<>();
        String currentVideo = "[0:v]";
        // input 0 is the background; layers start at input index 1
        for (int i = 0; i < layers.size(); i++) {
            int inputIdx = i + 1;
            String nextLabel = (i == layers.size() - 1) ? "[vout]" : "[ov" + i + "]";
            parts.add(currentVideo + "[" + inputIdx + ":v]overlay=0:0" + nextLabel);
            currentVideo = nextLabel;
        }

        if (layers.isEmpty()) {
            // No video layers — just pass background through
            parts.add("[0:v]copy[vout]");
        }

        // Audio mixing — audio inputs follow video layer inputs
        if (!tracks.isEmpty()) {
            int audioInputOffset = layers.size() + 1; // +1 for bg color source
            StringBuilder amix = new StringBuilder();
            for (int i = 0; i < tracks.size(); i++) {
                amix.append("[").append(audioInputOffset + i).append(":a]");
            }
            amix.append("amix=inputs=").append(tracks.size()).append(":normalize=0[aout]");
            parts.add(amix.toString());
        }

        return String.join(";", parts);
    }
}
