package com.engine.editor.ffmpeg;

import java.nio.file.Path;

public class VideoLayerSpec {

    private final Path filePath;
    private final double startAt;
    private final int order;
    private final boolean hasAlpha;
    private final String codec;

    private final boolean freezeLastFrame;
    private final boolean loopLayer;

    public VideoLayerSpec(Path filePath, double startAt, int order, boolean hasAlpha, boolean freezeLastFrame) {
        this(filePath, startAt, order, hasAlpha, freezeLastFrame, null, false);
    }

    public VideoLayerSpec(Path filePath, double startAt, int order, boolean hasAlpha, boolean freezeLastFrame, String codec) {
        this(filePath, startAt, order, hasAlpha, freezeLastFrame, codec, false);
    }

    public VideoLayerSpec(Path filePath, double startAt, int order, boolean hasAlpha, boolean freezeLastFrame, String codec, boolean loopLayer) {
        this.filePath = filePath;
        this.startAt = startAt;
        this.order = order;
        this.hasAlpha = hasAlpha;
        this.freezeLastFrame = freezeLastFrame;
        this.codec = codec;
        this.loopLayer = loopLayer;
    }

    public Path getFilePath() { return filePath; }
    public double getStartAt() { return startAt; }
    public int getOrder() { return order; }
    public boolean isHasAlpha() { return hasAlpha; }
    public boolean isFreezeLastFrame() { return freezeLastFrame; }
    public String getCodec() { return codec; }
    public boolean isLoopLayer() { return loopLayer; }
}
