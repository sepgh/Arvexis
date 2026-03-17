package com.engine.editor.ffmpeg;

public class HlsOptions {

    private final int segmentDurationSeconds;
    private final String playlistName;

    private HlsOptions(Builder builder) {
        this.segmentDurationSeconds = builder.segmentDurationSeconds;
        this.playlistName = builder.playlistName;
    }

    public int getSegmentDurationSeconds() { return segmentDurationSeconds; }
    public String getPlaylistName() { return playlistName; }

    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private int segmentDurationSeconds = 6;
        private String playlistName = "playlist.m3u8";

        public Builder segmentDurationSeconds(int secs) { this.segmentDurationSeconds = secs; return this; }
        public Builder playlistName(String name) { this.playlistName = name; return this; }
        public HlsOptions build() { return new HlsOptions(this); }
    }
}
