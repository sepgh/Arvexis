package io.github.sepgh.arvexis.embeddedruntime.testkit;

import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameSessionRepository;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameKey;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSession;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSessionId;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.PlayerId;

import java.util.Comparator;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryGameSessionRepository implements GameSessionRepository {
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
        sessions.put(gameSession.sessionId().value(), gameSession);
        return gameSession;
    }
}
