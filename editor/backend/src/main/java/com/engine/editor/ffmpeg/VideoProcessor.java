package com.engine.editor.ffmpeg;

import java.io.IOException;
import java.nio.file.Path;

/**
 * Implementation-agnostic interface for video processing operations.
 * The default implementation wraps FFmpeg/FFprobe CLI tools, but this
 * interface can be backed by any other tool in the future.
 */
public interface VideoProcessor {

    /**
     * Probe a media file and return its metadata.
     *
     * @param filePath path to the video or audio file
     * @return populated {@link MediaInfo}
     * @throws IOException if probing fails or the file is unreadable
     */
    MediaInfo probe(Path filePath) throws IOException;

    /**
     * Composite multiple video layers and audio tracks into a single output file.
     * Layers are stacked in order (index 0 = bottom-most), with the background
     * color rendered beneath everything. Each layer may have a {@code start-at}
     * timeline offset.
     *
     * @param spec  full description of the composite operation
     * @return path to the produced output file
     * @throws IOException if compositing fails
     */
    Path composite(CompositeSpec spec) throws IOException;

    /**
     * Transcode an existing file to a different codec / resolution / bit-rate.
     *
     * @param inputPath  source file
     * @param outputPath destination file
     * @param options    transcode parameters
     * @return {@code outputPath} for convenience
     * @throws IOException if transcoding fails
     */
    Path transcode(Path inputPath, Path outputPath, TranscodeOptions options) throws IOException;

    /**
     * Segment a video file into HLS (.m3u8 + .ts) format.
     *
     * @param inputPath source file (already at the target resolution/codec)
     * @param outputDir directory in which to write the playlist and segments
     * @param options   HLS parameters
     * @throws IOException if segmentation fails
     */
    void generateHls(Path inputPath, Path outputDir, HlsOptions options) throws IOException;

    /**
     * Returns {@code true} if the underlying tools (ffmpeg, ffprobe) are
     * reachable on the current system PATH.
     */
    boolean isAvailable();
}
