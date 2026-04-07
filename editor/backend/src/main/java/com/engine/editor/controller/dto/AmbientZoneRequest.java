package com.engine.editor.controller.dto;

public record AmbientZoneRequest(
    String id,
    String name,
    String assetId,
    Double defaultVolume,
    Integer defaultFadeMs,
    Boolean loop
) {}
