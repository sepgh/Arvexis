package com.engine.editor.controller.dto;

public record CreateEdgeRequest(
    String sourceNodeId,
    String targetNodeId,
    String sourceDecisionKey,
    Integer sourceConditionOrder,
    String sourceConditionName
) {}
