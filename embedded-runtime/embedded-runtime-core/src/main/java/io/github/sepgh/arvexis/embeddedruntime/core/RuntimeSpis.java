package io.github.sepgh.arvexis.embeddedruntime.core;

import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameDefinition;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameKey;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSession;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSessionId;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSnapshot;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.PlayerId;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.PlayerProfile;

import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.function.Supplier;

public final class RuntimeSpis {
    private RuntimeSpis() {
    }

    public interface GameDefinitionProvider {
        Optional<GameDefinition> findGame(GameKey gameKey);

        default GameDefinition requireGame(GameKey gameKey) {
            return findGame(gameKey).orElseThrow(() -> new NoSuchElementException("Unknown game: " + gameKey.value()));
        }
    }

    public interface AuthorizationResolver {
        Object resolveAuthorizationContext();
    }

    public interface PlayerResolver {
        PlayerProfile resolvePlayer(Object authorizationContext);
    }

    public interface GameAccessPolicy {
        boolean canAccess(PlayerProfile player, GameDefinition gameDefinition);
    }

    public interface GameSessionRepository {
        Optional<GameSession> findById(GameSessionId sessionId);

        Optional<GameSession> findLatest(PlayerId playerId, GameKey gameKey);

        boolean existsByPlayerAndGame(PlayerId playerId, GameKey gameKey);

        GameSession save(GameSession gameSession);
    }

    public interface GameSessionService {
        GameSession loadOrCreateSession(
            PlayerProfile player,
            GameDefinition gameDefinition,
            GameSessionId requestedSessionId,
            Supplier<GameSnapshot> initialSnapshotSupplier
        );

        boolean hasSession(PlayerProfile player, GameKey gameKey);

        GameSession saveSession(GameSession gameSession);
    }

    public interface RuntimeResourceLocator {
        String sceneHlsUrl(GameDefinition gameDefinition, String sceneId);

        String transitionHlsUrl(GameDefinition gameDefinition, String edgeId);

        String assetUrl(GameDefinition gameDefinition, String assetRelPath);
    }
}
