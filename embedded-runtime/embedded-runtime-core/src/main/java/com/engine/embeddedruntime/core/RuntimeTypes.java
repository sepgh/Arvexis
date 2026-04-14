package com.engine.embeddedruntime.core;

import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public final class RuntimeTypes {
    private RuntimeTypes() {
    }

    public record GameKey(String value) {
        public GameKey {
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException("gameKey is required");
            }
        }

        @Override
        public String toString() {
            return value;
        }
    }

    public record PlayerId(String value) {
        public PlayerId {
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException("playerId is required");
            }
        }

        @Override
        public String toString() {
            return value;
        }
    }

    public record GameSessionId(String value) {
        public GameSessionId {
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException("sessionId is required");
            }
        }

        public static GameSessionId random() {
            return new GameSessionId(UUID.randomUUID().toString());
        }

        @Override
        public String toString() {
            return value;
        }
    }

    public record PlayerProfile(
        PlayerId playerId,
        String externalSubject,
        String principalName,
        Map<String, Object> attributes,
        String displayName
    ) {
        public PlayerProfile {
            Objects.requireNonNull(playerId, "playerId");
            attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
        }
    }

    public record GameDefinition(
        GameKey gameKey,
        String displayName,
        Path manifestPath,
        Path outputDir,
        Path projectDir
    ) {
        public GameDefinition {
            Objects.requireNonNull(gameKey, "gameKey");
            Objects.requireNonNull(manifestPath, "manifestPath");
            Objects.requireNonNull(outputDir, "outputDir");
            manifestPath = manifestPath.toAbsolutePath().normalize();
            outputDir = outputDir.toAbsolutePath().normalize();
            projectDir = (projectDir != null ? projectDir : manifestPath.getParent()).toAbsolutePath().normalize();
            displayName = (displayName == null || displayName.isBlank()) ? gameKey.value() : displayName;
        }
    }

    public record AmbientState(
        String action,
        String zoneId,
        String assetRelPath,
        Double volume,
        Integer fadeMs,
        Boolean loop
    ) {
    }

    public record GameSnapshot(
        String currentSceneId,
        Map<String, Object> variables,
        boolean gameOver,
        AmbientState ambient
    ) {
        public GameSnapshot {
            if (currentSceneId == null || currentSceneId.isBlank()) {
                throw new IllegalArgumentException("currentSceneId is required");
            }
            variables = variables == null ? Map.of() : Map.copyOf(variables);
        }
    }

    public record GameSession(
        GameSessionId sessionId,
        GameKey gameKey,
        PlayerId playerId,
        GameSnapshot snapshot,
        Instant createdAt,
        Instant updatedAt,
        long version
    ) {
        public GameSession {
            Objects.requireNonNull(sessionId, "sessionId");
            Objects.requireNonNull(gameKey, "gameKey");
            Objects.requireNonNull(playerId, "playerId");
            Objects.requireNonNull(snapshot, "snapshot");
            createdAt = createdAt == null ? Instant.now() : createdAt;
            updatedAt = updatedAt == null ? createdAt : updatedAt;
        }
    }
}
