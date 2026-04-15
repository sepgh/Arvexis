package io.github.sepgh.arvexis.editor.model;

public class EdgeTransitionData {

    private String type;
    private Double duration;
    private String config;

    public EdgeTransitionData() {}

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Double getDuration() { return duration; }
    public void setDuration(Double duration) { this.duration = duration; }

    public String getConfig() { return config; }
    public void setConfig(String config) { this.config = config; }
}
