package com.engine.embeddedruntime.core;

import com.engine.embeddedruntime.core.RuntimeSpis.GameDefinitionProvider;
import com.engine.embeddedruntime.core.RuntimeSpis.GameSessionRepository;
import com.engine.embeddedruntime.core.RuntimeSpis.RuntimeResourceLocator;
import com.engine.embeddedruntime.core.RuntimeTypes.GameDefinition;
import com.engine.embeddedruntime.core.RuntimeTypes.GameKey;
import com.engine.embeddedruntime.core.RuntimeTypes.GameSession;
import com.engine.embeddedruntime.core.RuntimeTypes.GameSessionId;
import com.engine.embeddedruntime.core.RuntimeTypes.PlayerId;
import com.engine.embeddedruntime.core.RuntimeTypes.PlayerProfile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DefaultGameRuntimeFacadeTest {
    @TempDir
    Path tempDir;

    @Test
    void isolatesSessionsByPlayerAndGame() throws IOException {
        GameDefinition gameA = writeGame("game-a", "Game A", "scene-a-start", "scene-a-end");
        GameDefinition gameB = writeGame("game-b", "Game B", "scene-b-start", "scene-b-end");
        DefaultGameRuntimeFacade facade = facade(Map.of(gameA.gameKey().value(), gameA, gameB.gameKey().value(), gameB), (player, definition) -> true);

        PlayerProfile playerOne = player("player-one");
        PlayerProfile playerTwo = player("player-two");

        GameRuntimeFacade.GameStateResponse playerOneGameA = facade.getGameState(playerOne, gameA.gameKey(), null, null);
        GameRuntimeFacade.GameStateResponse playerTwoGameA = facade.getGameState(playerTwo, gameA.gameKey(), null, null);
        GameRuntimeFacade.GameStateResponse playerOneGameB = facade.getGameState(playerOne, gameB.gameKey(), null, null);

        assertNotEquals(playerOneGameA.sessionId(), playerTwoGameA.sessionId());
        assertNotEquals(playerOneGameA.sessionId(), playerOneGameB.sessionId());
        assertEquals("scene-a-start", playerOneGameA.currentSceneId());
        assertEquals("scene-b-start", playerOneGameB.currentSceneId());

        facade.decide(playerOne, gameA.gameKey(), playerOneGameA.sessionId(), "GO", null);

        GameRuntimeFacade.GameStateResponse playerOneGameAAfter = facade.getGameState(playerOne, gameA.gameKey(), playerOneGameA.sessionId(), null);
        GameRuntimeFacade.GameStateResponse playerTwoGameAAfter = facade.getGameState(playerTwo, gameA.gameKey(), playerTwoGameA.sessionId(), null);
        GameRuntimeFacade.GameStateResponse playerOneGameBAfter = facade.getGameState(playerOne, gameB.gameKey(), playerOneGameB.sessionId(), null);

        assertEquals("scene-a-end", playerOneGameAAfter.currentSceneId());
        assertTrue(playerOneGameAAfter.isEnd());
        assertEquals("scene-a-start", playerTwoGameAAfter.currentSceneId());
        assertFalse(playerTwoGameAAfter.isEnd());
        assertEquals("scene-b-start", playerOneGameBAfter.currentSceneId());
        assertFalse(playerOneGameBAfter.isEnd());
    }

    @Test
    void enforcesAccessChecksSeparatelyFromAuthentication() throws IOException {
        GameDefinition gameA = writeGame("game-a", "Game A", "scene-a-start", "scene-a-end");
        DefaultGameRuntimeFacade facade = facade(Map.of(gameA.gameKey().value(), gameA), (player, definition) -> !"blocked-player".equals(player.playerId().value()));

        assertEquals("Game A", facade.getGameInfo(player("allowed-player"), gameA.gameKey()).projectName());
        assertThrows(SecurityException.class, () -> facade.getGameInfo(player("blocked-player"), gameA.gameKey()));
    }

    @Test
    void rejectsSessionReuseAcrossPlayerOrGameBoundaries() throws IOException {
        GameDefinition gameA = writeGame("game-a", "Game A", "scene-a-start", "scene-a-end");
        GameDefinition gameB = writeGame("game-b", "Game B", "scene-b-start", "scene-b-end");
        DefaultGameRuntimeFacade facade = facade(Map.of(gameA.gameKey().value(), gameA, gameB.gameKey().value(), gameB), (player, definition) -> true);

        PlayerProfile playerOne = player("player-one");
        PlayerProfile playerTwo = player("player-two");
        GameRuntimeFacade.GameStateResponse state = facade.getGameState(playerOne, gameA.gameKey(), null, null);

        assertThrows(SecurityException.class, () -> facade.getGameState(playerTwo, gameA.gameKey(), state.sessionId(), null));
        assertThrows(SecurityException.class, () -> facade.getGameState(playerOne, gameB.gameKey(), state.sessionId(), null));
    }

    private DefaultGameRuntimeFacade facade(
        Map<String, GameDefinition> definitions,
        RuntimeSpis.GameAccessPolicy accessPolicy
    ) {
        GameDefinitionProvider provider = gameKey -> Optional.ofNullable(definitions.get(gameKey.value()));
        GameSessionRepository repository = new InMemoryRepository();
        return new DefaultGameRuntimeFacade(
            provider,
            accessPolicy,
            new DefaultGameSessionService(repository),
            resourceLocator()
        );
    }

    private RuntimeResourceLocator resourceLocator() {
        return new RuntimeResourceLocator() {
            @Override
            public String sceneHlsUrl(GameDefinition gameDefinition, String sceneId) {
                return "/games/" + gameDefinition.gameKey().value() + "/hls/" + sceneId + "/master.m3u8";
            }

            @Override
            public String transitionHlsUrl(GameDefinition gameDefinition, String edgeId) {
                return "/games/" + gameDefinition.gameKey().value() + "/hls/trans_" + edgeId + "/master.m3u8";
            }

            @Override
            public String assetUrl(GameDefinition gameDefinition, String assetRelPath) {
                return "/games/" + gameDefinition.gameKey().value() + "/assets/" + assetRelPath;
            }
        };
    }

    private PlayerProfile player(String playerId) {
        return new PlayerProfile(new PlayerId(playerId), playerId, playerId, Map.of(), playerId);
    }

    private GameDefinition writeGame(String gameKey, String displayName, String rootSceneId, String endSceneId) throws IOException {
        Path projectDir = Files.createDirectories(tempDir.resolve(gameKey));
        Path outputDir = Files.createDirectories(projectDir.resolve("output"));
        Path manifestPath = projectDir.resolve("manifest.json");
        Files.writeString(manifestPath, manifestJson(displayName, rootSceneId, endSceneId));
        return new GameDefinition(new GameKey(gameKey), displayName, manifestPath, outputDir, projectDir);
    }

    private String manifestJson(String displayName, String rootSceneId, String endSceneId) {
        return """
            {
              "rootNodeId": "%s",
              "project": {
                "name": "%s",
                "decisionTimeoutSecs": 5.0,
                "defaultLocaleCode": "en"
              },
              "nodes": [
                {
                  "id": "%s",
                  "name": "Start",
                  "type": "scene",
                  "decisions": [
                    {
                      "decisionKey": "GO",
                      "isDefault": true,
                      "decisionOrder": 0
                    }
                  ]
                },
                {
                  "id": "%s",
                  "name": "End",
                  "type": "scene",
                  "isEnd": true
                }
              ],
              "edges": [
                {
                  "id": "edge-go",
                  "sourceNodeId": "%s",
                  "targetNodeId": "%s",
                  "sourceDecisionKey": "GO"
                }
              ]
            }
            """.formatted(rootSceneId, displayName, rootSceneId, endSceneId, rootSceneId, endSceneId);
    }

    private static final class InMemoryRepository implements GameSessionRepository {
        private final Map<String, GameSession> sessions = new ConcurrentHashMap<>();

        @Override
        public Optional<GameSession> findById(GameSessionId sessionId) {
            return Optional.ofNullable(sessions.get(sessionId.value()));
        }

        @Override
        public Optional<GameSession> findLatest(PlayerId playerId, GameKey gameKey) {
            return sessions.values().stream()
                .filter(session -> session.playerId().equals(playerId) && session.gameKey().equals(gameKey))
                .max(Comparator.comparing(GameSession::updatedAt));
        }

        @Override
        public boolean existsByPlayerAndGame(PlayerId playerId, GameKey gameKey) {
            return sessions.values().stream().anyMatch(session -> session.playerId().equals(playerId) && session.gameKey().equals(gameKey));
        }

        @Override
        public GameSession save(GameSession gameSession) {
            GameSession stored = new GameSession(
                gameSession.sessionId(),
                gameSession.gameKey(),
                gameSession.playerId(),
                gameSession.snapshot(),
                gameSession.createdAt() == null ? Instant.now() : gameSession.createdAt(),
                gameSession.updatedAt() == null ? Instant.now() : gameSession.updatedAt(),
                gameSession.version()
            );
            sessions.put(stored.sessionId().value(), stored);
            return stored;
        }
    }
}
