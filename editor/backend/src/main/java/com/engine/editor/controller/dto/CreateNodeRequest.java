package com.engine.editor.controller.dto;

public record CreateNodeRequest(
    String id,
    String name,
    String type,
    Double posX,
    Double posY
) {}
