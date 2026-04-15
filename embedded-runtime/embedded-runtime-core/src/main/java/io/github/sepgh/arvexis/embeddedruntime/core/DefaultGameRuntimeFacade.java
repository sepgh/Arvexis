package io.github.sepgh.arvexis.embeddedruntime.core;

import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameAccessPolicy;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameDefinitionProvider;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameSessionService;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.RuntimeResourceLocator;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.AmbientState;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameDefinition;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameKey;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSession;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSessionId;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSnapshot;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.PlayerProfile;
import io.github.sepgh.arvexis.embeddedruntime.core.game.GameEngine;
import io.github.sepgh.arvexis.embeddedruntime.core.game.GameState;
import io.github.sepgh.arvexis.embeddedruntime.core.game.Manifest;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

public class DefaultGameRuntimeFacade implements GameRuntimeFacade {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final GameDefinitionProvider gameDefinitionProvider;
    private final GameAccessPolicy gameAccessPolicy;
    private final GameSessionService gameSessionService;
    private final RuntimeResourceLocator resourceLocator;
    private final Map<String, LoadedGame> gameCache = new ConcurrentHashMap<>();

    public DefaultGameRuntimeFacade(
        GameDefinitionProvider gameDefinitionProvider,
        GameAccessPolicy gameAccessPolicy,
        GameSessionService gameSessionService,
        RuntimeResourceLocator resourceLocator
    ) {
        this.gameDefinitionProvider = Objects.requireNonNull(gameDefinitionProvider, "gameDefinitionProvider");
        this.gameAccessPolicy = Objects.requireNonNull(gameAccessPolicy, "gameAccessPolicy");
        this.gameSessionService = Objects.requireNonNull(gameSessionService, "gameSessionService");
        this.resourceLocator = Objects.requireNonNull(resourceLocator, "resourceLocator");
    }

    @Override
    public GameInfoResponse getGameInfo(PlayerProfile player, GameKey gameKey) {
        LoadedGame loadedGame = loadGame(player, gameKey);
        String name = loadedGame.manifest.project != null && loadedGame.manifest.project.name != null
            ? loadedGame.manifest.project.name
            : loadedGame.definition.displayName();
        return new GameInfoResponse(name);
    }

    @Override
    public GameStateResponse getGameState(PlayerProfile player, GameKey gameKey, GameSessionId sessionId, String locale) {
        LoadedGame loadedGame = loadGame(player, gameKey);
        GameSession session = gameSessionService.loadOrCreateSession(player, loadedGame.definition, sessionId, () -> initialSnapshot(loadedGame));
        return buildStateResponse(loadedGame, session, toGameState(session.snapshot()), locale);
    }

    @Override
    public DecisionResponse decide(PlayerProfile player, GameKey gameKey, GameSessionId sessionId, String decisionKey, String locale) {
        LoadedGame loadedGame = loadGame(player, gameKey);
        GameSession session = gameSessionService.loadOrCreateSession(player, loadedGame.definition, sessionId, () -> initialSnapshot(loadedGame));
        GameState state = toGameState(session.snapshot());
        if (state.gameOver) {
            throw new IllegalStateException("Game is over. Call restart to play again.");
        }
        GameEngine.TraversalResult result = loadedGame.engine.decide(state, decisionKey);
        applyAmbientTraversal(loadedGame, state, result);
        GameSession saved = gameSessionService.saveSession(withSnapshot(session, toSnapshot(state)));
        TransitionDescriptor transition = null;
        if (result.transEdge() != null) {
            transition = new TransitionDescriptor(
                result.transEdge().id,
                result.transEdge().transition.type,
                result.transEdge().transition.duration,
                result.transEdge().transition.backgroundColor,
                resourceLocator.transitionHlsUrl(loadedGame.definition, result.transEdge().id)
            );
        }
        return new DecisionResponse(
            saved.sessionId(),
            transition,
            buildAmbientDirective(loadedGame, result.sceneEdge() != null ? result.sceneEdge().ambient : null),
            buildStateResponse(loadedGame, saved, state, locale)
        );
    }

    @Override
    public GameStateResponse restart(PlayerProfile player, GameKey gameKey, GameSessionId sessionId, String locale) {
        LoadedGame loadedGame = loadGame(player, gameKey);
        GameSession session = gameSessionService.loadOrCreateSession(player, loadedGame.definition, sessionId, () -> initialSnapshot(loadedGame));
        GameState state = new GameState(loadedGame.manifest.rootNodeId);
        initializeAmbientState(loadedGame, state);
        GameSession saved = gameSessionService.saveSession(withSnapshot(session, toSnapshot(state)));
        return buildStateResponse(loadedGame, saved, state, locale);
    }

    @Override
    public HasSaveResponse hasSave(PlayerProfile player, GameKey gameKey) {
        LoadedGame loadedGame = loadGame(player, gameKey);
        return new HasSaveResponse(gameSessionService.hasSession(player, loadedGame.definition.gameKey()));
    }

    @Override
    public LocalesResponse getLocales(PlayerProfile player, GameKey gameKey) {
        LoadedGame loadedGame = loadGame(player, gameKey);
        return new LocalesResponse(
            loadedGame.engine.defaultLocaleCode(),
            loadedGame.engine.availableLocales().stream().map(l -> new LocaleDescriptor(l.code, l.name)).toList()
        );
    }

    private LoadedGame loadGame(PlayerProfile player, GameKey gameKey) {
        LoadedGame loadedGame = gameCache.computeIfAbsent(gameKey.value(), key -> {
            GameDefinition definition = gameDefinitionProvider.requireGame(gameKey);
            try {
                Manifest manifest = MAPPER.readValue(definition.manifestPath().toFile(), Manifest.class);
                return new LoadedGame(definition, manifest, new GameEngine(manifest));
            } catch (IOException e) {
                throw new IllegalStateException("Failed to load manifest for game " + gameKey.value(), e);
            }
        });
        if (!gameAccessPolicy.canAccess(player, loadedGame.definition)) {
            throw new SecurityException("Player is not allowed to access game " + gameKey.value());
        }
        return loadedGame;
    }

    private GameSnapshot initialSnapshot(LoadedGame loadedGame) {
        GameState state = new GameState(loadedGame.manifest.rootNodeId);
        initializeAmbientState(loadedGame, state);
        return toSnapshot(state);
    }

    private GameStateResponse buildStateResponse(LoadedGame loadedGame, GameSession session, GameState state, String locale) {
        Manifest.NodeData scene = loadedGame.engine.nodeById(state.currentSceneId);
        List<GameEngine.DecisionInfo> decisions = loadedGame.engine.availableDecisions(state, state.currentSceneId);
        boolean hasExplicitDecisions = loadedGame.engine.sceneHasExplicitDecisions(state.currentSceneId);
        boolean hideDecisionButtons = loadedGame.engine.hideDecisionButtons(state.currentSceneId);
        boolean showDecisionInputIndicator = loadedGame.engine.showDecisionInputIndicator(state.currentSceneId);
        boolean autoContinues = loadedGame.engine.sceneAutoContinues(state.currentSceneId);
        String autoContinueNextSceneUrl = null;
        if (autoContinues) {
            GameEngine.TraversalResult traversal = loadedGame.engine.peek(state, "CONTINUE");
            if (traversal != null && traversal.nextScene() != null) {
                autoContinueNextSceneUrl = resourceLocator.sceneHlsUrl(loadedGame.definition, traversal.nextScene().id);
            }
        }
        String musicUrl = scene != null && scene.musicAssetRelPath != null
            ? resourceLocator.assetUrl(loadedGame.definition, scene.musicAssetRelPath)
            : null;
        List<SubtitleDescriptor> subtitles = locale != null && !locale.isBlank()
            ? loadedGame.engine.getSubtitlesForScene(state.currentSceneId, locale).stream()
                .map(sub -> new SubtitleDescriptor(sub.startTime, sub.endTime, sub.text))
                .toList()
            : List.of();
        Map<String, String> decisionTranslations = new LinkedHashMap<>();
        if (locale != null && !locale.isBlank()) {
            for (Manifest.DecisionTranslationEntry translation : loadedGame.engine.getDecisionTranslationsForScene(state.currentSceneId, locale)) {
                decisionTranslations.put(translation.decisionKey, translation.label);
            }
        }
        return new GameStateResponse(
            session.sessionId(),
            state.currentSceneId,
            scene != null ? scene.name : state.currentSceneId,
            resourceLocator.sceneHlsUrl(loadedGame.definition, state.currentSceneId),
            state.gameOver,
            scene != null ? scene.computedDuration : null,
            scene != null ? scene.decisionAppearanceConfig : null,
            loadedGame.engine.decisionTimeoutSecs(),
            hideDecisionButtons,
            hideDecisionButtons && showDecisionInputIndicator,
            hasExplicitDecisions,
            decisions.stream().map(d -> new DecisionDescriptor(d.key(), d.isDefault(), d.keyboardKey())).toList(),
            mapTransitionUrls(loadedGame, loadedGame.engine.preloadUrlsForScene(state.currentSceneId)),
            mapSceneUrls(loadedGame, loadedGame.engine.preloadSceneUrlsForScene(state, state.currentSceneId)),
            autoContinues,
            scene != null && scene.loopVideo,
            autoContinueNextSceneUrl,
            musicUrl,
            buildAmbientState(loadedGame, state.ambient),
            buildAmbientDirective(loadedGame, scene != null ? scene.ambient : null),
            state.variables,
            subtitles,
            decisionTranslations
        );
    }

    private List<String> mapTransitionUrls(LoadedGame loadedGame, List<String> urls) {
        return urls.stream()
            .map(url -> url.replace("/hls/trans_", "").replace("/master.m3u8", ""))
            .map(edgeId -> resourceLocator.transitionHlsUrl(loadedGame.definition, edgeId))
            .toList();
    }

    private List<String> mapSceneUrls(LoadedGame loadedGame, List<String> urls) {
        return urls.stream()
            .map(url -> url.replace("/hls/", "").replace("/master.m3u8", ""))
            .map(sceneId -> resourceLocator.sceneHlsUrl(loadedGame.definition, sceneId))
            .toList();
    }

    private void initializeAmbientState(LoadedGame loadedGame, GameState gameState) {
        ensureAmbientState(gameState);
        Manifest.NodeData scene = loadedGame.engine.nodeById(gameState.currentSceneId);
        applyAmbientConfig(loadedGame, gameState, scene != null ? scene.ambient : null);
    }

    private void applyAmbientTraversal(LoadedGame loadedGame, GameState gameState, GameEngine.TraversalResult result) {
        if (result == null) {
            return;
        }
        ensureAmbientState(gameState);
        applyAmbientConfig(loadedGame, gameState, result.sceneEdge() != null ? result.sceneEdge().ambient : null);
        applyAmbientConfig(loadedGame, gameState, result.nextScene() != null ? result.nextScene().ambient : null);
    }

    private void applyAmbientConfig(LoadedGame loadedGame, GameState gameState, Manifest.AmbientConfigData config) {
        ensureAmbientState(gameState);
        String action = normalizeAmbientAction(config != null ? config.action : null);
        if ("inherit".equals(action)) {
            if (config != null && "set".equalsIgnoreCase(gameState.ambient.action) && gameState.ambient.assetRelPath != null && !gameState.ambient.assetRelPath.isBlank()) {
                if (config.volumeOverride != null) {
                    gameState.ambient.volume = clampVolume(config.volumeOverride);
                }
                if (config.fadeMsOverride != null) {
                    gameState.ambient.fadeMs = Math.max(0, config.fadeMsOverride);
                }
            }
            return;
        }
        if ("stop".equals(action)) {
            gameState.ambient = new GameState.AmbientState();
            return;
        }
        Manifest.AmbientZoneData zone = loadedGame.engine.ambientZoneById(config.zoneId);
        if (zone == null || zone.assetRelPath == null || zone.assetRelPath.isBlank()) {
            gameState.ambient = new GameState.AmbientState();
            return;
        }
        GameState.AmbientState ambient = new GameState.AmbientState();
        ambient.action = "set";
        ambient.zoneId = zone.id;
        ambient.assetRelPath = zone.assetRelPath;
        ambient.volume = config.volumeOverride != null ? clampVolume(config.volumeOverride) : clampVolume(zone.defaultVolume);
        ambient.fadeMs = config.fadeMsOverride != null ? Math.max(0, config.fadeMsOverride) : Math.max(0, zone.defaultFadeMs);
        ambient.loop = zone.loop;
        gameState.ambient = ambient;
    }

    private AmbientDescriptor buildAmbientDirective(LoadedGame loadedGame, Manifest.AmbientConfigData config) {
        String action = normalizeAmbientAction(config != null ? config.action : null);
        if ("inherit".equals(action)) {
            return new AmbientDescriptor(
                action,
                null,
                null,
                config != null ? config.volumeOverride : null,
                config != null ? config.fadeMsOverride : null,
                null
            );
        }
        if ("stop".equals(action)) {
            return new AmbientDescriptor(action, null, null, null, config != null ? Math.max(0, config.fadeMsOverride != null ? config.fadeMsOverride : 0) : 0, null);
        }
        Manifest.AmbientZoneData zone = config != null ? loadedGame.engine.ambientZoneById(config.zoneId) : null;
        if (zone == null || zone.assetRelPath == null || zone.assetRelPath.isBlank()) {
            return new AmbientDescriptor("stop", null, null, null, 0, null);
        }
        return new AmbientDescriptor(
            action,
            zone.id,
            resourceLocator.assetUrl(loadedGame.definition, zone.assetRelPath),
            config.volumeOverride != null ? clampVolume(config.volumeOverride) : clampVolume(zone.defaultVolume),
            config.fadeMsOverride != null ? Math.max(0, config.fadeMsOverride) : Math.max(0, zone.defaultFadeMs),
            zone.loop
        );
    }

    private AmbientDescriptor buildAmbientState(LoadedGame loadedGame, GameState.AmbientState ambientState) {
        if (ambientState == null || !"set".equalsIgnoreCase(ambientState.action) || ambientState.assetRelPath == null || ambientState.assetRelPath.isBlank()) {
            return new AmbientDescriptor("stop", null, null, null, null, null);
        }
        return new AmbientDescriptor(
            "set",
            ambientState.zoneId,
            resourceLocator.assetUrl(loadedGame.definition, ambientState.assetRelPath),
            clampVolume(ambientState.volume != null ? ambientState.volume : 1.0),
            ambientState.fadeMs != null ? Math.max(0, ambientState.fadeMs) : 0,
            ambientState.loop == null || ambientState.loop
        );
    }

    private void ensureAmbientState(GameState gameState) {
        if (gameState.ambient == null) {
            gameState.ambient = new GameState.AmbientState();
        }
        if (gameState.ambient.action == null || gameState.ambient.action.isBlank()) {
            gameState.ambient.action = "stop";
        }
    }

    private String normalizeAmbientAction(String action) {
        if (action == null || action.isBlank()) {
            return "inherit";
        }
        String normalized = action.trim().toLowerCase(java.util.Locale.ROOT);
        return switch (normalized) {
            case "inherit", "set", "stop" -> normalized;
            default -> "inherit";
        };
    }

    private double clampVolume(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    private GameSnapshot toSnapshot(GameState state) {
        AmbientState ambient = state.ambient == null ? null : new AmbientState(
            state.ambient.action,
            state.ambient.zoneId,
            state.ambient.assetRelPath,
            state.ambient.volume,
            state.ambient.fadeMs,
            state.ambient.loop
        );
        return new GameSnapshot(state.currentSceneId, state.variables, state.gameOver, ambient);
    }

    private GameState toGameState(GameSnapshot snapshot) {
        GameState state = new GameState(snapshot.currentSceneId());
        state.variables.putAll(snapshot.variables());
        state.gameOver = snapshot.gameOver();
        if (snapshot.ambient() != null) {
            state.ambient.action = snapshot.ambient().action();
            state.ambient.zoneId = snapshot.ambient().zoneId();
            state.ambient.assetRelPath = snapshot.ambient().assetRelPath();
            state.ambient.volume = snapshot.ambient().volume();
            state.ambient.fadeMs = snapshot.ambient().fadeMs();
            state.ambient.loop = snapshot.ambient().loop();
        }
        return state;
    }

    private GameSession withSnapshot(GameSession session, GameSnapshot snapshot) {
        return new GameSession(
            session.sessionId(),
            session.gameKey(),
            session.playerId(),
            snapshot,
            session.createdAt(),
            session.updatedAt(),
            session.version()
        );
    }

    private record LoadedGame(GameDefinition definition, Manifest manifest, GameEngine engine) {
    }
}
