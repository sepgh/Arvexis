package com.engine.editor.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class GraphNode {

    private String id;
    private String name;
    private String type;
    private boolean isRoot;
    private boolean isEnd;
    private String backgroundColor;
    private String decisionAppearanceConfig;
    private double posX;
    private double posY;

    public GraphNode() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    @JsonProperty("isRoot")
    public boolean isRoot() { return isRoot; }
    public void setRoot(boolean root) { this.isRoot = root; }

    @JsonProperty("isEnd")
    public boolean isEnd() { return isEnd; }
    public void setEnd(boolean end) { this.isEnd = end; }

    public String getBackgroundColor() { return backgroundColor; }
    public void setBackgroundColor(String backgroundColor) { this.backgroundColor = backgroundColor; }

    public String getDecisionAppearanceConfig() { return decisionAppearanceConfig; }
    public void setDecisionAppearanceConfig(String decisionAppearanceConfig) {
        this.decisionAppearanceConfig = decisionAppearanceConfig;
    }

    public double getPosX() { return posX; }
    public void setPosX(double posX) { this.posX = posX; }

    public double getPosY() { return posY; }
    public void setPosY(double posY) { this.posY = posY; }
}
