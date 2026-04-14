package com.engine.embeddedruntime.core;

import com.engine.embeddedruntime.core.RuntimeTypes.GameKey;
import com.engine.embeddedruntime.core.RuntimeTypes.GameSessionId;
import com.engine.embeddedruntime.core.RuntimeTypes.PlayerProfile;

import java.util.List;
import java.util.Map;

public interface GameRuntimeFacade {
    GameInfoResponse getGameInfo(PlayerProfile player, GameKey gameKey);

    GameStateResponse getGameState(PlayerProfile player, GameKey gameKey, GameSessionId sessionId, String locale);

    DecisionResponse decide(PlayerProfile player, GameKey gameKey, GameSessionId sessionId, String decisionKey, String locale);

    GameStateResponse restart(PlayerProfile player, GameKey gameKey, GameSessionId sessionId, String locale);

    HasSaveResponse hasSave(PlayerProfile player, GameKey gameKey);

    LocalesResponse getLocales(PlayerProfile player, GameKey gameKey);

    record GameInfoResponse(String projectName) {
    }

    record DecisionDescriptor(String key, boolean isDefault, String keyboardKey) {
    }

    record AmbientDescriptor(String action, String zoneId, String assetUrl, Double volume, Integer fadeMs, Boolean loop) {
    }

    record SubtitleDescriptor(double startTime, double endTime, String text) {
    }

    record TransitionDescriptor(
        String edgeId,
        String type,
        double duration,
        String backgroundColor,
        String transitionHlsUrl
    ) {
    }

    record GameStateResponse(
        GameSessionId sessionId,
        String currentSceneId,
        String currentSceneName,
        String sceneHlsUrl,
        boolean isEnd,
        Double duration,
        String decisionAppearanceConfig,
        double decisionTimeoutSecs,
        boolean hideDecisionButtons,
        boolean showDecisionInputIndicator,
        boolean hasExplicitDecisions,
        List<DecisionDescriptor> decisions,
        List<String> preloadUrls,
        List<String> preloadSceneUrls,
        boolean autoContinue,
        boolean loopVideo,
        String autoContinueNextSceneUrl,
        String musicUrl,
        AmbientDescriptor ambient,
        AmbientDescriptor sceneAmbient,
        Map<String, Object> variables,
        List<SubtitleDescriptor> subtitles,
        Map<String, String> decisionTranslations
    ) {
        public GameStateResponse {
            decisions = decisions == null ? List.of() : List.copyOf(decisions);
            preloadUrls = preloadUrls == null ? List.of() : List.copyOf(preloadUrls);
            preloadSceneUrls = preloadSceneUrls == null ? List.of() : List.copyOf(preloadSceneUrls);
            variables = variables == null ? Map.of() : Map.copyOf(variables);
            subtitles = subtitles == null ? List.of() : List.copyOf(subtitles);
            decisionTranslations = decisionTranslations == null ? Map.of() : Map.copyOf(decisionTranslations);
        }
    }

    record DecisionResponse(
        GameSessionId sessionId,
        TransitionDescriptor transition,
        AmbientDescriptor edgeAmbient,
        GameStateResponse nextState
    ) {
    }

    record HasSaveResponse(boolean hasSave) {
    }

    record LocaleDescriptor(String code, String name) {
    }

    record LocalesResponse(String defaultLocaleCode, List<LocaleDescriptor> locales) {
        public LocalesResponse {
            locales = locales == null ? List.of() : List.copyOf(locales);
        }
    }
}
