package com.engine.editor.model;

public class GraphEdge {

    private String id;
    private String sourceNodeId;
    private String sourceDecisionKey;
    private Integer sourceConditionOrder;
    private String targetNodeId;
    private EdgeTransitionData transition;

    public GraphEdge() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSourceNodeId() { return sourceNodeId; }
    public void setSourceNodeId(String sourceNodeId) { this.sourceNodeId = sourceNodeId; }

    public String getSourceDecisionKey() { return sourceDecisionKey; }
    public void setSourceDecisionKey(String sourceDecisionKey) { this.sourceDecisionKey = sourceDecisionKey; }

    public Integer getSourceConditionOrder() { return sourceConditionOrder; }
    public void setSourceConditionOrder(Integer sourceConditionOrder) {
        this.sourceConditionOrder = sourceConditionOrder;
    }

    public String getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(String targetNodeId) { this.targetNodeId = targetNodeId; }

    public EdgeTransitionData getTransition() { return transition; }
    public void setTransition(EdgeTransitionData transition) { this.transition = transition; }
}
