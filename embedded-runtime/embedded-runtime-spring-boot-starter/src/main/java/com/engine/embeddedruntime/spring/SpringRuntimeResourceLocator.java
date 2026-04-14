package com.engine.embeddedruntime.spring;

import com.engine.embeddedruntime.core.RuntimeSpis.RuntimeResourceLocator;
import com.engine.embeddedruntime.core.RuntimeTypes.GameDefinition;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;

public class SpringRuntimeResourceLocator implements RuntimeResourceLocator {
    private final EmbeddedRuntimeProperties properties;

    public SpringRuntimeResourceLocator(EmbeddedRuntimeProperties properties) {
        this.properties = properties;
    }

    @Override
    public String sceneHlsUrl(GameDefinition gameDefinition, String sceneId) {
        return gameBasePath(gameDefinition) + "/hls/" + UriUtils.encodePathSegment(sceneId, StandardCharsets.UTF_8) + "/master.m3u8";
    }

    @Override
    public String transitionHlsUrl(GameDefinition gameDefinition, String edgeId) {
        return gameBasePath(gameDefinition) + "/hls/trans_" + UriUtils.encodePathSegment(edgeId, StandardCharsets.UTF_8) + "/master.m3u8";
    }

    @Override
    public String assetUrl(GameDefinition gameDefinition, String assetRelPath) {
        return gameBasePath(gameDefinition) + "/assets/" + UriUtils.encodePath(assetRelPath, StandardCharsets.UTF_8);
    }

    private String gameBasePath(GameDefinition gameDefinition) {
        return properties.getBasePath() + "/games/" + UriUtils.encodePathSegment(gameDefinition.gameKey().value(), StandardCharsets.UTF_8);
    }
}
