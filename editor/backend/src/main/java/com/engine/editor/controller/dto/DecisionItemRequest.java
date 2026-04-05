package com.engine.editor.controller.dto;

public record DecisionItemRequest(
    String decisionKey,
    Boolean isDefault,
    Integer decisionOrder,
    String keyboardKey,
    String conditionExpression
) {}
