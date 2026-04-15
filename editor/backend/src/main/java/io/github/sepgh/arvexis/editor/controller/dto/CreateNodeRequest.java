package io.github.sepgh.arvexis.editor.controller.dto;

public record CreateNodeRequest(
    String id,
    String name,
    String type,
    Double posX,
    Double posY
) {}
