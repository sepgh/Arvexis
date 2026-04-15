package io.github.sepgh.arvexis.embeddedruntime.core;

import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameSessionRepository;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameSessionService;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameDefinition;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameKey;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSession;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSessionId;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSnapshot;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.PlayerProfile;

import java.time.Instant;
import java.util.Objects;
import java.util.function.Supplier;

public class DefaultGameSessionService implements GameSessionService {
    private final GameSessionRepository repository;

    public DefaultGameSessionService(GameSessionRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    @Override
    public GameSession loadOrCreateSession(
        PlayerProfile player,
        GameDefinition gameDefinition,
        GameSessionId requestedSessionId,
        Supplier<GameSnapshot> initialSnapshotSupplier
    ) {
        Objects.requireNonNull(player, "player");
        Objects.requireNonNull(gameDefinition, "gameDefinition");
        Objects.requireNonNull(initialSnapshotSupplier, "initialSnapshotSupplier");
        if (requestedSessionId != null) {
            GameSession existing = repository.findById(requestedSessionId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Unknown session: " + requestedSessionId.value()));
            if (!existing.playerId().equals(player.playerId()) || !existing.gameKey().equals(gameDefinition.gameKey())) {
                throw new SecurityException("Session does not belong to the current player/game");
            }
            return existing;
        }
        return repository.findLatest(player.playerId(), gameDefinition.gameKey())
            .orElseGet(() -> repository.save(new GameSession(
                GameSessionId.random(),
                gameDefinition.gameKey(),
                player.playerId(),
                initialSnapshotSupplier.get(),
                Instant.now(),
                Instant.now(),
                0
            )));
    }

    @Override
    public boolean hasSession(PlayerProfile player, GameKey gameKey) {
        return repository.existsByPlayerAndGame(player.playerId(), gameKey);
    }

    @Override
    public GameSession saveSession(GameSession gameSession) {
        return repository.save(new GameSession(
            gameSession.sessionId(),
            gameSession.gameKey(),
            gameSession.playerId(),
            gameSession.snapshot(),
            gameSession.createdAt(),
            Instant.now(),
            gameSession.version() + 1
        ));
    }
}
