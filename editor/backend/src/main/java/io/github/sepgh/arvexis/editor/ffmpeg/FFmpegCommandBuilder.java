package io.github.sepgh.arvexis.editor.ffmpeg;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Fluent builder for FFmpeg CLI commands.
 *
 * <p>Example — compositing two layers:</p>
 * <pre>{@code
 * List<String> cmd = FFmpegCommandBuilder.create()
 *     .overwrite()
 *     .input("/tmp/bg.mp4")
 *     .input("/tmp/overlay.mov")
 *     .filterComplex("[0:v][1:v]overlay=0:0[out]")
 *     .mapVideo("[out]")
 *     .videoCodec("libx264")
 *     .audioCodec("aac")
 *     .output("/tmp/result.mp4")
 *     .build();
 * }</pre>
 */
public class FFmpegCommandBuilder {

    private String ffmpegPath = "ffmpeg";
    private final List<String> globalArgs = new ArrayList<>();
    private final List<List<String>> inputs = new ArrayList<>();
    private String filterComplex;
    private final List<String> mappings = new ArrayList<>();
    private final List<String> videoArgs = new ArrayList<>();
    private final List<String> audioArgs = new ArrayList<>();
    private final List<String> extraArgs = new ArrayList<>();
    private String outputPath;

    private FFmpegCommandBuilder() {}

    public static FFmpegCommandBuilder create() {
        return new FFmpegCommandBuilder();
    }

    /** Override the ffmpeg binary path (default: {@code ffmpeg}). */
    public FFmpegCommandBuilder ffmpegPath(String path) {
        this.ffmpegPath = path;
        return this;
    }

    /** Add {@code -y} to automatically overwrite the output file. */
    public FFmpegCommandBuilder overwrite() {
        globalArgs.add("-y");
        return this;
    }

    /** Add {@code -hide_banner} to suppress the FFmpeg version banner. */
    public FFmpegCommandBuilder hideBanner() {
        globalArgs.add("-hide_banner");
        return this;
    }

    /** Add {@code -loglevel <level>} (e.g., {@code "error"}, {@code "quiet"}). */
    public FFmpegCommandBuilder logLevel(String level) {
        globalArgs.add("-loglevel");
        globalArgs.add(level);
        return this;
    }

    /**
     * Set {@code -threads N} to limit FFmpeg CPU thread usage.
     * Pass {@code null} or {@code 0} to let FFmpeg choose automatically (default).
     */
    public FFmpegCommandBuilder threads(Integer count) {
        if (count != null && count > 0) {
            globalArgs.add("-threads");
            globalArgs.add(String.valueOf(count));
        }
        return this;
    }

    /** Append a raw global argument (before any {@code -i} inputs). */
    public FFmpegCommandBuilder globalArg(String arg) {
        globalArgs.add(arg);
        return this;
    }

    /** Add a simple input file. */
    public FFmpegCommandBuilder input(String path) {
        inputs.add(Arrays.asList("-i", path));
        return this;
    }

    /**
     * Add an input with extra per-input options placed <em>before</em> the {@code -i}.
     * Example: {@code inputWithOptions(List.of("-ss", "00:00:05"), "/tmp/clip.mp4")}
     */
    public FFmpegCommandBuilder inputWithOptions(List<String> preInputOpts, String path) {
        List<String> entry = new ArrayList<>(preInputOpts);
        entry.add("-i");
        entry.add(path);
        inputs.add(Collections.unmodifiableList(entry));
        return this;
    }

    /** Add a {@code lavfi} color source input (e.g., as a solid-color background). */
    public FFmpegCommandBuilder colorInput(String color, String resolution, int fps, double duration) {
        String value = String.format("color=c=%s:s=%s:r=%d:d=%.6f", color, resolution, fps, duration);
        inputs.add(Arrays.asList("-f", "lavfi", "-i", value));
        return this;
    }

    /** Set the {@code -filter_complex} expression. */
    public FFmpegCommandBuilder filterComplex(String expression) {
        this.filterComplex = expression;
        return this;
    }

    /** Add a {@code -map} directive. */
    public FFmpegCommandBuilder map(String streamSpec) {
        mappings.add("-map");
        mappings.add(streamSpec);
        return this;
    }

    /** Convenience: {@code -map "[label]"} for a video output stream. */
    public FFmpegCommandBuilder mapVideo(String filterLabel) {
        return map(filterLabel);
    }

    /** Set the video codec with {@code -c:v <codec>}. */
    public FFmpegCommandBuilder videoCodec(String codec) {
        videoArgs.add("-c:v");
        videoArgs.add(codec);
        return this;
    }

    /** Set the audio codec with {@code -c:a <codec>}. */
    public FFmpegCommandBuilder audioCodec(String codec) {
        audioArgs.add("-c:a");
        audioArgs.add(codec);
        return this;
    }

    /** Set video bit rate with {@code -b:v <kbps>k}. */
    public FFmpegCommandBuilder videoBitRate(int kbps) {
        videoArgs.add("-b:v");
        videoArgs.add(kbps + "k");
        return this;
    }

    /** Set audio bit rate with {@code -b:a <kbps>k}. */
    public FFmpegCommandBuilder audioBitRate(int kbps) {
        audioArgs.add("-b:a");
        audioArgs.add(kbps + "k");
        return this;
    }

    /** Set audio sample rate with {@code -ar <hz>}. */
    public FFmpegCommandBuilder audioSampleRate(int hz) {
        audioArgs.add("-ar");
        audioArgs.add(String.valueOf(hz));
        return this;
    }

    /** Set frame rate with {@code -r <fps>}. */
    public FFmpegCommandBuilder frameRate(int fps) {
        videoArgs.add("-r");
        videoArgs.add(String.valueOf(fps));
        return this;
    }

    /** Set output resolution with {@code -s <WxH>}. */
    public FFmpegCommandBuilder resolution(String resolution) {
        videoArgs.add("-s");
        videoArgs.add(resolution);
        return this;
    }

    /** Set output pixel format with {@code -pix_fmt <fmt>}. */
    public FFmpegCommandBuilder pixelFormat(String fmt) {
        videoArgs.add("-pix_fmt");
        videoArgs.add(fmt);
        return this;
    }

    /** Limit the output duration with {@code -t <seconds>}. */
    public FFmpegCommandBuilder duration(double seconds) {
        if (seconds > 0) {
            extraArgs.add("-t");
            extraArgs.add(String.format("%.6f", seconds));
        }
        return this;
    }

    /** Configure HLS segmentation output. */
    public FFmpegCommandBuilder hlsSegmentDuration(int seconds) {
        extraArgs.add("-hls_time");
        extraArgs.add(String.valueOf(seconds));
        return this;
    }

    public FFmpegCommandBuilder hlsPlaylistType(String type) {
        extraArgs.add("-hls_playlist_type");
        extraArgs.add(type);
        return this;
    }

    public FFmpegCommandBuilder hlsSegmentFilename(String pattern) {
        extraArgs.add("-hls_segment_filename");
        extraArgs.add(pattern);
        return this;
    }

    /** Append raw extra arguments placed just before the output path. */
    public FFmpegCommandBuilder extraArg(String arg) {
        extraArgs.add(arg);
        return this;
    }

    /** Append multiple raw extra arguments. */
    public FFmpegCommandBuilder extraArgs(String... args) {
        extraArgs.addAll(Arrays.asList(args));
        return this;
    }

    /** Set the output file path (required). */
    public FFmpegCommandBuilder output(String path) {
        this.outputPath = path;
        return this;
    }

    /**
     * Build and return the final command as an immutable list of strings.
     *
     * @throws IllegalStateException if no output path has been set
     */
    public List<String> build() {
        if (outputPath == null || outputPath.isBlank()) {
            throw new IllegalStateException("FFmpegCommandBuilder: output path must be set before calling build()");
        }

        List<String> cmd = new ArrayList<>();
        cmd.add(ffmpegPath);
        cmd.addAll(globalArgs);

        for (List<String> input : inputs) {
            cmd.addAll(input);
        }

        if (filterComplex != null && !filterComplex.isBlank()) {
            cmd.add("-filter_complex");
            cmd.add(filterComplex);
        }

        cmd.addAll(mappings);
        cmd.addAll(videoArgs);
        cmd.addAll(audioArgs);
        cmd.addAll(extraArgs);
        cmd.add(outputPath);

        return Collections.unmodifiableList(cmd);
    }
}
