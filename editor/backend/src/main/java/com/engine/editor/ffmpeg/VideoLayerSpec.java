package com.engine.editor.ffmpeg;

import java.nio.file.Path;

public class VideoLayerSpec {

    private final Path filePath;
    private final double startAt;
    private final int order;
    private final boolean hasAlpha;
    private final String codec;

    private final boolean freezeLastFrame;

    public VideoLayerSpec(Path filePath, double startAt, int order, boolean hasAlpha, boolean freezeLastFrame) {
        this(filePath, startAt, order, hasAlpha, freezeLastFrame, null);
    }

    public VideoLayerSpec(Path filePath, double startAt, int order, boolean hasAlpha, boolean freezeLastFrame, String codec) {
        this.filePath = filePath;
        this.startAt = startAt;
        this.order = order;
        this.hasAlpha = hasAlpha;
        this.freezeLastFrame = freezeLastFrame;
        this.codec = codec;
    }

    public Path getFilePath() { return filePath; }
    public double getStartAt() { return startAt; }
    public int getOrder() { return order; }
    public boolean isHasAlpha() { return hasAlpha; }
    public boolean isFreezeLastFrame() { return freezeLastFrame; }
    public String getCodec() { return codec; }
}
