package com.engine.embeddedruntime.jpa;

import com.engine.embeddedruntime.core.RuntimeSpis.GameSessionRepository;
import com.engine.embeddedruntime.core.RuntimeTypes.GameKey;
import com.engine.embeddedruntime.core.RuntimeTypes.GameSession;
import com.engine.embeddedruntime.core.RuntimeTypes.GameSessionId;
import com.engine.embeddedruntime.core.RuntimeTypes.GameSnapshot;
import com.engine.embeddedruntime.core.RuntimeTypes.PlayerId;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.Optional;

@Transactional
public class JpaGameSessionRepositoryAdapter implements GameSessionRepository {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final JpaGameSessionSpringRepository repository;

    public JpaGameSessionRepositoryAdapter(JpaGameSessionSpringRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<GameSession> findById(GameSessionId sessionId) {
        return repository.findById(sessionId.value()).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<GameSession> findLatest(PlayerId playerId, GameKey gameKey) {
        return repository.findFirstByPlayerIdAndGameKeyOrderByUpdatedAtDesc(playerId.value(), gameKey.value()).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsByPlayerAndGame(PlayerId playerId, GameKey gameKey) {
        return repository.existsByPlayerIdAndGameKey(playerId.value(), gameKey.value());
    }

    @Override
    public GameSession save(GameSession gameSession) {
        return toDomain(repository.save(toEntity(gameSession)));
    }

    private GameSession toDomain(JpaGameSessionEntity entity) {
        try {
            return new GameSession(
                new GameSessionId(entity.getSessionId()),
                new GameKey(entity.getGameKey()),
                new PlayerId(entity.getPlayerId()),
                MAPPER.readValue(entity.getSnapshotJson(), GameSnapshot.class),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getVersion()
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to deserialize embedded runtime session snapshot", e);
        }
    }

    private JpaGameSessionEntity toEntity(GameSession gameSession) {
        JpaGameSessionEntity entity = new JpaGameSessionEntity();
        entity.setSessionId(gameSession.sessionId().value());
        entity.setGameKey(gameSession.gameKey().value());
        entity.setPlayerId(gameSession.playerId().value());
        entity.setSnapshotJson(toSnapshotJson(gameSession.snapshot()));
        entity.setCreatedAt(gameSession.createdAt());
        entity.setUpdatedAt(gameSession.updatedAt());
        entity.setVersion(gameSession.version());
        return entity;
    }

    private String toSnapshotJson(GameSnapshot snapshot) {
        try {
            return MAPPER.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize embedded runtime session snapshot", e);
        }
    }
}
