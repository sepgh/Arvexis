package com.engine.editor.controller.dto;

public record UpdateEdgeRequest(
    String transitionType,
    Double transitionDuration,
    String transitionConfig
) {}
