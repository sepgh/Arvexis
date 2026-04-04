package com.engine.editor.controller.dto;

public record VideoLayerRequest(String assetId, Double startAt, Integer startAtFrames, Boolean freezeLastFrame, Boolean loopLayer) {}
