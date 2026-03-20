package com.engine.editor.controller.dto;

public record UpdateNodeRequest(
    String name,
    Boolean isEnd,
    Boolean autoContinue,
    String backgroundColor,
    String decisionAppearanceConfig,
    String musicAssetId,
    Boolean clearMusicAsset,
    Double posX,
    Double posY
) {}
