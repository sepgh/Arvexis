package io.github.sepgh.arvexis.runtime.game;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.HashMap;
import java.util.Map;

/** Mutable game state: current scene position + all state variable values. */
@JsonIgnoreProperties(ignoreUnknown = true)
public class GameState {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AmbientState {
        public String action = "stop";
        public String zoneId;
        public String assetRelPath;
        public Double volume;
        public Integer fadeMs;
        public Boolean loop;
    }

    public String currentSceneId;
    public Map<String, Object> variables = new HashMap<>();
    public boolean gameOver = false;
    public AmbientState ambient;

    public GameState() {}

    public GameState(String sceneId) {
        this.currentSceneId = sceneId;
        this.ambient = new AmbientState();
    }
}
