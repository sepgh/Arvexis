package io.github.sepgh.arvexis.embeddedruntime.jpa;

import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.AmbientState;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameKey;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSession;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSessionId;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSnapshot;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.PlayerId;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import(JpaGameSessionRepositoryAdapterTest.JpaTestConfiguration.class)
class JpaGameSessionRepositoryAdapterTest {
    @Autowired
    private JpaGameSessionSpringRepository springRepository;

    @Test
    void persistsAndQueriesSessionsByPlayerAndGame() {
        JpaGameSessionRepositoryAdapter repository = new JpaGameSessionRepositoryAdapter(springRepository);
        GameSession older = repository.save(session("session-1", "game-a", "player-a", "scene-1", Instant.parse("2026-01-01T00:00:00Z"), 0));
        GameSession newer = repository.save(session("session-2", "game-a", "player-a", "scene-2", Instant.parse("2026-01-01T00:05:00Z"), 1));
        repository.save(session("session-3", "game-b", "player-a", "scene-3", Instant.parse("2026-01-01T00:10:00Z"), 0));
        repository.save(session("session-4", "game-a", "player-b", "scene-4", Instant.parse("2026-01-01T00:15:00Z"), 0));

        GameSession loaded = repository.findById(newer.sessionId()).orElseThrow();
        GameSession latest = repository.findLatest(new PlayerId("player-a"), new GameKey("game-a")).orElseThrow();

        assertEquals("scene-2", loaded.snapshot().currentSceneId());
        assertEquals("set", loaded.snapshot().ambient().action());
        assertEquals(1, loaded.version());
        assertEquals(newer.sessionId(), latest.sessionId());
        assertTrue(repository.existsByPlayerAndGame(new PlayerId("player-a"), new GameKey("game-a")));
        assertFalse(repository.existsByPlayerAndGame(new PlayerId("player-c"), new GameKey("game-a")));
        assertEquals(older.createdAt(), repository.findById(older.sessionId()).orElseThrow().createdAt());
    }

    private GameSession session(String sessionId, String gameKey, String playerId, String sceneId, Instant updatedAt, long version) {
        Instant createdAt = updatedAt.minusSeconds(60);
        return new GameSession(
            new GameSessionId(sessionId),
            new GameKey(gameKey),
            new PlayerId(playerId),
            new GameSnapshot(sceneId, java.util.Map.of("score", version), false, new AmbientState("set", "forest", "ambient/forest.ogg", 0.5, 250, true)),
            createdAt,
            updatedAt,
            version
        );
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EntityScan(basePackageClasses = JpaGameSessionEntity.class)
    @EnableJpaRepositories(basePackageClasses = JpaGameSessionSpringRepository.class)
    static class JpaTestConfiguration {
    }
}
