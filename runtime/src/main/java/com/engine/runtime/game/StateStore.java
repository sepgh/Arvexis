package com.engine.runtime.game;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Persists and loads GameState from a JSON file alongside the manifest. */
public class StateStore {

    private static final String STATE_FILE = "game-state.json";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final Path stateFile;

    public StateStore(Path projectDir) {
        this.stateFile = projectDir.resolve(STATE_FILE);
    }

    public void save(GameState state) {
        try {
            MAPPER.writerWithDefaultPrettyPrinter().writeValue(stateFile.toFile(), state);
        } catch (IOException e) {
            System.err.println("[StateStore] Failed to save state: " + e.getMessage());
        }
    }

    /** Returns null if no saved state exists or is unreadable. */
    public GameState load() {
        if (!Files.exists(stateFile)) return null;
        try {
            return MAPPER.readValue(stateFile.toFile(), GameState.class);
        } catch (IOException e) {
            System.err.println("[StateStore] Failed to load state, starting fresh: " + e.getMessage());
            return null;
        }
    }

    public void delete() {
        try { Files.deleteIfExists(stateFile); } catch (IOException ignored) {}
    }
}
