package io.github.sepgh.arvexis.editor.controller.dto;

import java.util.List;

public record UpdateProjectConfigRequest(
    String name,
    String assetsDirectory,
    String outputDirectory,
    String previewResolution,
    List<String> compileResolutions,
    List<AmbientZoneRequest> ambientZones,
    Integer fps,
    Integer audioSampleRate,
    Integer audioBitRate,
    Double decisionTimeoutSecs,
    String defaultLocaleCode,
    String defaultBackgroundColor,
    Boolean hideDecisionButtons,
    Boolean showDecisionInputIndicator,
    Boolean ffmpegThreadsAuto,
    Integer ffmpegThreads
) {}
