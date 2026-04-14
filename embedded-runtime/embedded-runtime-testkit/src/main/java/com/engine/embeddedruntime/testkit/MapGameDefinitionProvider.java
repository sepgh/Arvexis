package com.engine.embeddedruntime.testkit;

import com.engine.embeddedruntime.core.RuntimeSpis.GameDefinitionProvider;
import com.engine.embeddedruntime.core.RuntimeTypes.GameDefinition;
import com.engine.embeddedruntime.core.RuntimeTypes.GameKey;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

public class MapGameDefinitionProvider implements GameDefinitionProvider {
    private final Map<String, GameDefinition> definitions;

    public MapGameDefinitionProvider(Map<String, GameDefinition> definitions) {
        this.definitions = new LinkedHashMap<>(definitions);
    }

    @Override
    public Optional<GameDefinition> findGame(GameKey gameKey) {
        return Optional.ofNullable(definitions.get(gameKey.value()));
    }
}
