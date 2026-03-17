package com.engine.editor.controller.dto;

public record CreateNodeRequest(
    String name,
    String type,
    Double posX,
    Double posY
) {}
