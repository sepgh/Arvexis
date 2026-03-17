package com.engine.editor.ffmpeg;

public class TranscodeOptions {

    private final String outputResolution;
    private final int fps;
    private final String videoCodec;
    private final String audioCodec;
    private final int videoBitRateKbps;
    private final int audioBitRateKbps;
    private final int audioSampleRate;

    private TranscodeOptions(Builder builder) {
        this.outputResolution = builder.outputResolution;
        this.fps = builder.fps;
        this.videoCodec = builder.videoCodec;
        this.audioCodec = builder.audioCodec;
        this.videoBitRateKbps = builder.videoBitRateKbps;
        this.audioBitRateKbps = builder.audioBitRateKbps;
        this.audioSampleRate = builder.audioSampleRate;
    }

    public String getOutputResolution() { return outputResolution; }
    public int getFps() { return fps; }
    public String getVideoCodec() { return videoCodec; }
    public String getAudioCodec() { return audioCodec; }
    public int getVideoBitRateKbps() { return videoBitRateKbps; }
    public int getAudioBitRateKbps() { return audioBitRateKbps; }
    public int getAudioSampleRate() { return audioSampleRate; }

    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private String outputResolution;
        private int fps = 30;
        private String videoCodec = "libx264";
        private String audioCodec = "aac";
        private int videoBitRateKbps = 4000;
        private int audioBitRateKbps = 128;
        private int audioSampleRate = 44100;

        public Builder outputResolution(String res) { this.outputResolution = res; return this; }
        public Builder fps(int fps) { this.fps = fps; return this; }
        public Builder videoCodec(String codec) { this.videoCodec = codec; return this; }
        public Builder audioCodec(String codec) { this.audioCodec = codec; return this; }
        public Builder videoBitRateKbps(int kbps) { this.videoBitRateKbps = kbps; return this; }
        public Builder audioBitRateKbps(int kbps) { this.audioBitRateKbps = kbps; return this; }
        public Builder audioSampleRate(int rate) { this.audioSampleRate = rate; return this; }
        public TranscodeOptions build() { return new TranscodeOptions(this); }
    }
}
