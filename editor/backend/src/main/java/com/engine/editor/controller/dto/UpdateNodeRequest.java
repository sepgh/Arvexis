package com.engine.editor.controller.dto;

public record UpdateNodeRequest(
    String name,
    Boolean isEnd,
    String backgroundColor,
    String decisionAppearanceConfig,
    Double posX,
    Double posY
) {}
