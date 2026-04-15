package io.github.sepgh.arvexis.editor.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class GraphNode {

    /** A single exit handle: the source of one outgoing edge. */
    public record NodeExit(String key, String label, boolean isDefault) {}

    private String id;
    private String name;
    private String type;
    private boolean isRoot;
    private boolean isEnd;
    private boolean autoContinue;
    private boolean loopVideo;
    private String backgroundColor;
    private String decisionAppearanceConfig;
    private String musicAssetId;
    private AmbientConfigData ambient;
    private Boolean hideDecisionButtons;
    private Boolean showDecisionInputIndicator;
    private double posX;
    private double posY;
    private List<NodeExit> exits;

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

    @JsonProperty("autoContinue")
    public boolean isAutoContinue() { return autoContinue; }
    public void setAutoContinue(boolean autoContinue) { this.autoContinue = autoContinue; }

    @JsonProperty("loopVideo")
    public boolean isLoopVideo() { return loopVideo; }
    public void setLoopVideo(boolean loopVideo) { this.loopVideo = loopVideo; }

    public String getBackgroundColor() { return backgroundColor; }
    public void setBackgroundColor(String backgroundColor) { this.backgroundColor = backgroundColor; }

    public String getDecisionAppearanceConfig() { return decisionAppearanceConfig; }
    public void setDecisionAppearanceConfig(String decisionAppearanceConfig) {
        this.decisionAppearanceConfig = decisionAppearanceConfig;
    }

    public String getMusicAssetId() { return musicAssetId; }
    public void setMusicAssetId(String musicAssetId) { this.musicAssetId = musicAssetId; }

    public AmbientConfigData getAmbient() { return ambient; }
    public void setAmbient(AmbientConfigData ambient) { this.ambient = ambient; }

    public Boolean getHideDecisionButtons() { return hideDecisionButtons; }
    public void setHideDecisionButtons(Boolean hideDecisionButtons) {
        this.hideDecisionButtons = hideDecisionButtons;
    }

    public Boolean getShowDecisionInputIndicator() { return showDecisionInputIndicator; }
    public void setShowDecisionInputIndicator(Boolean showDecisionInputIndicator) {
        this.showDecisionInputIndicator = showDecisionInputIndicator;
    }

    public double getPosX() { return posX; }
    public void setPosX(double posX) { this.posX = posX; }

    public double getPosY() { return posY; }
    public void setPosY(double posY) { this.posY = posY; }

    public List<NodeExit> getExits() { return exits; }
    public void setExits(List<NodeExit> exits) { this.exits = exits; }
}
