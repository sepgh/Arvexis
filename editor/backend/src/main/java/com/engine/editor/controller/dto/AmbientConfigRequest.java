package com.engine.editor.controller.dto;

public record AmbientConfigRequest(
    String action,
    String zoneId,
    Double volumeOverride,
    Boolean clearVolumeOverride,
    Integer fadeMsOverride,
    Boolean clearFadeMsOverride
) {}
