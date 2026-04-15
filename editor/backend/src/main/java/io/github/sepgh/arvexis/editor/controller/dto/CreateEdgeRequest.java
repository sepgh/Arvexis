package io.github.sepgh.arvexis.editor.controller.dto;

public record CreateEdgeRequest(
    String id,
    String sourceNodeId,
    String targetNodeId,
    String sourceDecisionKey,
    Integer sourceConditionOrder,
    String sourceConditionName
) {}
