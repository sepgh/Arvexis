package com.engine.editor.model;

public class AmbientZoneData {

    private String id;
    private String name;
    private String assetId;
    private String assetFileName;
    private String assetRelPath;
    private double defaultVolume = 1.0;
    private int defaultFadeMs = 1000;
    private boolean loop = true;

    public AmbientZoneData() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAssetId() { return assetId; }
    public void setAssetId(String assetId) { this.assetId = assetId; }

    public String getAssetFileName() { return assetFileName; }
    public void setAssetFileName(String assetFileName) { this.assetFileName = assetFileName; }

    public String getAssetRelPath() { return assetRelPath; }
    public void setAssetRelPath(String assetRelPath) { this.assetRelPath = assetRelPath; }

    public double getDefaultVolume() { return defaultVolume; }
    public void setDefaultVolume(double defaultVolume) { this.defaultVolume = defaultVolume; }

    public int getDefaultFadeMs() { return defaultFadeMs; }
    public void setDefaultFadeMs(int defaultFadeMs) { this.defaultFadeMs = defaultFadeMs; }

    public boolean isLoop() { return loop; }
    public void setLoop(boolean loop) { this.loop = loop; }
}
