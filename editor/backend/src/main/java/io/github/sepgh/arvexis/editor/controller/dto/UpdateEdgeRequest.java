package io.github.sepgh.arvexis.editor.controller.dto;

public record UpdateEdgeRequest(
    String transitionType,
    Double transitionDuration,
    String transitionConfig
) {}
