package com.engine.runtime.game;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.HashMap;
import java.util.Map;

/** Mutable game state: current scene position + all state variable values. */
@JsonIgnoreProperties(ignoreUnknown = true)
public class GameState {

    public String currentSceneId;
    public Map<String, Object> variables = new HashMap<>();
    public boolean gameOver = false;

    public GameState() {}

    public GameState(String sceneId) {
        this.currentSceneId = sceneId;
    }
}
