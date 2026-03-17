package com.engine.editor.ffmpeg;

import java.nio.file.Path;

public class VideoLayerSpec {

    private final Path filePath;
    private final double startAt;
    private final int order;

    public VideoLayerSpec(Path filePath, double startAt, int order) {
        this.filePath = filePath;
        this.startAt = startAt;
        this.order = order;
    }

    public Path getFilePath() { return filePath; }
    public double getStartAt() { return startAt; }
    public int getOrder() { return order; }
}
