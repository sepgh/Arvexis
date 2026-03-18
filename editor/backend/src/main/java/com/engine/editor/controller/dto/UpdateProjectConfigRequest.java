package com.engine.editor.controller.dto;

import java.util.List;

public record UpdateProjectConfigRequest(
    String name,
    String assetsDirectory,
    String outputDirectory,
    String previewResolution,
    List<String> compileResolutions,
    Integer fps,
    Integer audioSampleRate,
    Integer audioBitRate,
    Double decisionTimeoutSecs,
    String defaultLocaleCode,
    Integer ffmpegThreads
) {}
