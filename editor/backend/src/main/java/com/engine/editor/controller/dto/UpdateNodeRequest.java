package com.engine.editor.controller.dto;

public record UpdateNodeRequest(
    String name,
    Boolean isEnd,
    Boolean autoContinue,
    Boolean loopVideo,
    String backgroundColor,
    String decisionAppearanceConfig,
    String musicAssetId,
    Boolean clearMusicAsset,
    Double posX,
    Double posY
) {}
