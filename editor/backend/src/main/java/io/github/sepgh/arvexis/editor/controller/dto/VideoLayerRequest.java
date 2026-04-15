package io.github.sepgh.arvexis.editor.controller.dto;

public record VideoLayerRequest(String assetId, Double startAt, Integer startAtFrames, Boolean freezeLastFrame, Boolean loopLayer) {}
