package io.github.sepgh.arvexis.editor.model;

public class AmbientConfigData {

    private String action = "inherit";
    private String zoneId;
    private Double volumeOverride;
    private Integer fadeMsOverride;

    public AmbientConfigData() {}

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getZoneId() { return zoneId; }
    public void setZoneId(String zoneId) { this.zoneId = zoneId; }

    public Double getVolumeOverride() { return volumeOverride; }
    public void setVolumeOverride(Double volumeOverride) { this.volumeOverride = volumeOverride; }

    public Integer getFadeMsOverride() { return fadeMsOverride; }
    public void setFadeMsOverride(Integer fadeMsOverride) { this.fadeMsOverride = fadeMsOverride; }
}
