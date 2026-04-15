package io.github.sepgh.arvexis.editor.ffmpeg;

import java.nio.file.Path;
import java.util.List;

public class CompositeSpec {

    private final List<VideoLayerSpec> videoLayers;
    private final List<AudioTrackSpec> audioTracks;
    private final String backgroundColor;
    private final String outputResolution;
    private final int fps;
    private final double duration;
    private final Path outputPath;
    private final Integer ffmpegThreads;

    private CompositeSpec(Builder builder) {
        this.videoLayers = List.copyOf(builder.videoLayers);
        this.audioTracks = List.copyOf(builder.audioTracks);
        this.backgroundColor = builder.backgroundColor;
        this.outputResolution = builder.outputResolution;
        this.fps = builder.fps;
        this.duration = builder.duration;
        this.outputPath = builder.outputPath;
        this.ffmpegThreads = builder.ffmpegThreads;
    }

    public List<VideoLayerSpec> getVideoLayers() { return videoLayers; }
    public List<AudioTrackSpec> getAudioTracks() { return audioTracks; }
    public String getBackgroundColor() { return backgroundColor; }
    public String getOutputResolution() { return outputResolution; }
    public int getFps() { return fps; }
    public double getDuration() { return duration; }
    public Path getOutputPath() { return outputPath; }
    public Integer getFfmpegThreads() { return ffmpegThreads; }

    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private List<VideoLayerSpec> videoLayers = List.of();
        private List<AudioTrackSpec> audioTracks = List.of();
        private String backgroundColor = "black";
        private String outputResolution = "1920x1080";
        private int fps = 30;
        private double duration = 0;
        private Path outputPath;
        private Integer ffmpegThreads;

        public Builder videoLayers(List<VideoLayerSpec> layers) { this.videoLayers = layers; return this; }
        public Builder audioTracks(List<AudioTrackSpec> tracks) { this.audioTracks = tracks; return this; }
        public Builder backgroundColor(String color) { this.backgroundColor = color; return this; }
        public Builder outputResolution(String res) { this.outputResolution = res; return this; }
        public Builder fps(int fps) { this.fps = fps; return this; }
        public Builder duration(double duration) { this.duration = duration; return this; }
        public Builder outputPath(Path path) { this.outputPath = path; return this; }
        public Builder ffmpegThreads(Integer threads) { this.ffmpegThreads = threads; return this; }
        public CompositeSpec build() { return new CompositeSpec(this); }
    }
}
