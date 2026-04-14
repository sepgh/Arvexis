package com.engine.embeddedruntime.spring;

import com.engine.embeddedruntime.core.RuntimeSpis.AuthorizationResolver;
import com.engine.embeddedruntime.core.RuntimeSpis.GameAccessPolicy;
import com.engine.embeddedruntime.core.RuntimeSpis.GameDefinitionProvider;
import com.engine.embeddedruntime.core.RuntimeSpis.GameSessionRepository;
import com.engine.embeddedruntime.core.RuntimeSpis.PlayerResolver;
import com.engine.embeddedruntime.core.RuntimeTypes.GameDefinition;
import com.engine.embeddedruntime.core.RuntimeTypes.GameKey;
import com.engine.embeddedruntime.core.RuntimeTypes.GameSession;
import com.engine.embeddedruntime.core.RuntimeTypes.GameSessionId;
import com.engine.embeddedruntime.core.RuntimeTypes.PlayerId;
import com.engine.embeddedruntime.core.RuntimeTypes.PlayerProfile;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(
    classes = EmbeddedRuntimeStarterIntegrationTest.TestApplication.class,
    properties = "embedded.runtime.base-path=/host/runtime"
)
@AutoConfigureMockMvc
class EmbeddedRuntimeStarterIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void exposesRuntimeEndpointsUnderANonRootBasePath() throws Exception {
        mockMvc.perform(get("/host/runtime/games/game-a/api/game/info"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.projectName").value("Game A"));

        mockMvc.perform(get("/host/runtime/games/game-a/api/game/state"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.currentSceneId").value("scene-a-start"))
            .andExpect(jsonPath("$.sceneHlsUrl").value("/host/runtime/games/game-a/hls/scene-a-start/master.m3u8"));
    }

    @Test
    void servesPlayerAssetsAndBootstrapHtmlForEmbeddedUse() throws Exception {
        mockMvc.perform(get("/host/runtime/play/game-a"))
            .andExpect(status().isOk())
            .andExpect(content().string(containsString("/host/runtime/player/styles.css")))
            .andExpect(content().string(containsString("\"apiBasePath\":\"/host/runtime/games/game-a\"")));

        mockMvc.perform(get("/host/runtime/player/game.js"))
            .andExpect(status().isOk())
            .andExpect(content().string(containsString("window.ARVEXIS_RUNTIME_CONFIG")));
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class TestApplication {
        @Bean
        GameDefinitionProvider gameDefinitionProvider() throws IOException {
            GameDefinition definition = writeGame("game-a", "Game A", "scene-a-start", "scene-a-end");
            return gameKey -> Optional.ofNullable(gameKey.value().equals(definition.gameKey().value()) ? definition : null);
        }

        @Bean
        GameSessionRepository gameSessionRepository() {
            return new InMemoryRepository();
        }

        @Bean
        AuthorizationResolver authorizationResolver() {
            return () -> "web-player";
        }

        @Bean
        PlayerResolver playerResolver() {
            return authorizationContext -> new PlayerProfile(new PlayerId("web-player"), "web-player", "web-player", Map.of(), "Web Player");
        }

        @Bean
        GameAccessPolicy gameAccessPolicy() {
            return (player, definition) -> true;
        }

        private static GameDefinition writeGame(String gameKey, String displayName, String rootSceneId, String endSceneId) throws IOException {
            Path projectDir = Files.createTempDirectory("embedded-runtime-test-" + gameKey);
            Files.createDirectories(projectDir.resolve("output"));
            Files.createDirectories(projectDir.resolve("assets"));
            Path manifestPath = projectDir.resolve("manifest.json");
            Files.writeString(manifestPath, manifestJson(displayName, rootSceneId, endSceneId));
            return new GameDefinition(new GameKey(gameKey), displayName, manifestPath, projectDir.resolve("output"), projectDir);
        }

        private static String manifestJson(String displayName, String rootSceneId, String endSceneId) {
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
